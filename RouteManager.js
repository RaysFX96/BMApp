import { Geolocation } from '@capacitor/geolocation';
import { Motion } from '@capacitor/motion';
import { App } from '@capacitor/app';

/**
 * Calcola la distanza tra due punti GPS usando la formula Haversine (restituisce km)
 */
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raggio della Terra in KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * RouteManager.js
 * Handles route recording, GPS, motion sensors, and Google Maps viewing.
 */
const RouteManager = {
    session: null,
    locationWatcher: null,
    motionWatcher: null,
    syncInterval: null,
    appStateListener: null,
    currentCallbacks: null,

    // Filtri Sensori
    lastAngle: 0,
    lastG: 0,
    currentSpeed: 0,       // Velocità corrente per filtraggio
    angleBuffer: [],       // Buffer per Media Mobile
    bufferSize: 20,        // Aumentato a 20 campioni (più "viscoso")
    smoothingAngle: 0.015, // Ancora più restrittivo (da 0.02)
    smoothingG: 0.04,      // Coefficiente EMA G-Force
    deadzoneAngle: 3.0,    // Aumentata a 3 gradi (da 2.0)

    async startRecording(callbacks) {
        if (this.session) return;

        const permStatus = await Geolocation.checkPermissions();
        if (permStatus.location !== 'granted') {
            const request = await Geolocation.requestPermissions();
            if (request.location !== 'granted') throw new Error('Permessi GPS negati');
        }

        this.currentCallbacks = callbacks;

        // Attiva Foreground Service per evitare sospensione in standby
        if (window.AndroidFunction && window.AndroidFunction.toggleRouteService) {
            window.AndroidFunction.toggleRouteService(true);
        }

        this.session = {
            startTime: Date.now(),
            points: [],
            maxSpeed: 0,
            maxLeanL: 0,
            maxLeanR: 0,
            maxAccel: 0,
            elapsed: 0,
            totalDist: 0 // In KM
        };

        // Reset filtri per nuova sessione
        this.lastAngle = 0;
        this.lastG = 0;
        this.currentSpeed = 0;
        this.angleBuffer = [];

        this.locationWatcher = await Geolocation.watchPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 3000
        }, (pos, err) => {
            if (err || !pos) return;
            const speedKmh = Math.round((pos.coords.speed || 0) * 3.6);
            if (speedKmh > this.session.maxSpeed) this.session.maxSpeed = speedKmh;

            const newPoint = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                alt: pos.coords.altitude,
                speed: speedKmh,
                time: Date.now()
            };

            // Calcolo distanza cumulativa
            if (this.session.points.length > 0) {
                const prev = this.session.points[this.session.points.length - 1];
                const d = getDistance(prev.lat, prev.lng, newPoint.lat, newPoint.lng);
                // Filtro per evitare salti GPS assurdi (es. più di 200m tra due update di 1-3 secondi)
                if (d < 0.2) {
                    this.session.totalDist += d;
                }
            }

            this.session.points.push(newPoint);

            if (callbacks.onSpeed) callbacks.onSpeed(speedKmh);
            this.currentSpeed = speedKmh; // Salva velocità per filtro inclinazione
            if (callbacks.onAlt) callbacks.onAlt(Math.round(pos.coords.altitude || 0));
            if (callbacks.onDist) callbacks.onDist(this.session.totalDist);
        });

        // --- Sincronizzazione Real-Time con Java (Background) ---

        // 1. Polling periodico (ogni 3 secondi) per aggiornare la UI mentre l'app è aperta
        this.syncInterval = setInterval(() => {
            this.syncFromNative();
        }, 3000);

        // 2. Sincronizzazione immediata quando l'app torna in primo piano (Resume)
        this.appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                console.log("App tornata attiva, forzo sincronizzazione KM...");
                this.syncFromNative();
            }
        });

        this.motionWatcher = await Motion.addListener('accel', (event) => {
            const { x, y, z } = event.accelerationIncludingGravity;

            // Gestione orientamento per Landscape
            // In Portrait usiamo X, in Landscape usiamo Y
            let sideAxis = x;
            const orientation = window.screen?.orientation?.type || window.orientation;

            if (orientation === 'landscape-primary' || orientation === 90) {
                sideAxis = -y;
            } else if (orientation === 'landscape-secondary' || orientation === -90 || orientation === 270) {
                sideAxis = y;
            }

            // Invertiamo il segno per mappare correttamente Sinistra (<0) e Destra (>0)
            let rawAngle = -Math.atan2(sideAxis, z) * (180 / Math.PI);

            // 1. Filtro Media Mobile (Buffer)
            this.angleBuffer.push(rawAngle);
            if (this.angleBuffer.length > this.bufferSize) {
                this.angleBuffer.shift();
            }

            const avgAngle = this.angleBuffer.reduce((a, b) => a + b, 0) / this.angleBuffer.length;

            // 2. Filtro EMA (Esponenziale) sull'angolo mediato
            this.lastAngle = (avgAngle * this.smoothingAngle) + (this.lastAngle * (1 - this.smoothingAngle));

            // 3. Filtro basato sulla velocità GPS
            // Se la moto è ferma o quasi (< 5 km/h), forziamo l'inclinazione a zero
            // per evitare che le vibrazioni del motore generino falsi positivi.
            let displayAngle = Math.round(this.lastAngle);
            if (this.currentSpeed < 5) {
                displayAngle = 0;
            } else if (Math.abs(displayAngle) < this.deadzoneAngle) {
                displayAngle = 0;
            }

            if (displayAngle < 0) {
                const abs = Math.abs(displayAngle);
                if (abs > this.session.maxLeanL) this.session.maxLeanL = abs;
            } else {
                if (displayAngle > this.session.maxLeanR) this.session.maxLeanR = displayAngle;
            }

            const acc = event.acceleration || { x: 0, y: 0, z: 0 };
            const rawG = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) / 9.81;

            // 3. Filtro EMA per G-Force
            this.lastG = (rawG * this.smoothingG) + (this.lastG * (1 - this.smoothingG));
            if (this.lastG > this.session.maxAccel) this.session.maxAccel = this.lastG;

            if (callbacks.onLean) callbacks.onLean(displayAngle, this.session.maxLeanL, this.session.maxLeanR);
            if (callbacks.onAccel) callbacks.onAccel(this.lastG);
        });

        // Esegui una sincronizzazione iniziale
        this.syncFromNative();

        return this.session;
    },

    /**
     * Sincronizza i dati dal servizio nativo (Java) alla sessione JS
     */
    syncFromNative() {
        if (!this.session || !window.AndroidFunction || !window.AndroidFunction.getBackgroundData) return;

        try {
            const data = JSON.parse(window.AndroidFunction.getBackgroundData());
            const nativeDist = data.totalDist || 0;

            // Se la distanza nativa è maggiore (perché JS era in pausa), aggiorniamo JS
            if (nativeDist > this.session.totalDist) {
                this.session.totalDist = nativeDist;
                if (this.currentCallbacks && this.currentCallbacks.onDist) {
                    this.currentCallbacks.onDist(this.session.totalDist);
                }
            }
        } catch (e) {
            console.error("Errore sincronizzazione real-time:", e);
        }
    },

    async stopRecording() {
        if (!this.session) return null;

        if (this.locationWatcher) await Geolocation.clearWatch({ id: this.locationWatcher });
        if (this.motionWatcher) this.motionWatcher.remove();
        if (this.syncInterval) clearInterval(this.syncInterval);
        if (this.appStateListener) this.appStateListener.remove();

        this.syncInterval = null;
        this.appStateListener = null;

        // Recupera dati raccolti in background (Java)
        let nativeDist = 0;
        let nativePoints = [];
        if (window.AndroidFunction && window.AndroidFunction.getBackgroundData) {
            try {
                const data = JSON.parse(window.AndroidFunction.getBackgroundData());
                nativeDist = data.totalDist || 0;
                nativePoints = data.points || [];
            } catch (e) {
                console.error("Errore recupero dati nativi:", e);
            }
        }

        // Unione punti (evitando duplicati temporali troppo vicini se necessario, 
        // ma per semplicità ora li aggiungiamo se non presenti)
        // In realtà Java ha tracciato tutto, potremmo quasi usare solo quelli
        // ma JS ha le G-Force e inclinazione (che Java non traccia qui).
        // Strategia: usiamo la distanza di Java come riferimento finale se maggiore.
        const finalDist = Math.max(this.session.totalDist, nativeDist);

        // Disattiva Foreground Service
        if (window.AndroidFunction && window.AndroidFunction.toggleRouteService) {
            window.AndroidFunction.toggleRouteService(false);
        }

        const routeDuration = Math.floor((Date.now() - this.session.startTime) / 1000);
        const route = {
            id: Date.now(),
            date: new Date().toISOString(),
            duration: routeDuration,
            maxSpeed: this.session.maxSpeed,
            maxLeanL: this.session.maxLeanL,
            maxLeanR: this.session.maxLeanR,
            maxAccel: parseFloat(this.session.maxAccel).toFixed(1),
            totalDist: parseFloat(finalDist).toFixed(2),
            avgSpeed: routeDuration > 0 ? parseFloat((finalDist / (routeDuration / 3600))).toFixed(1) : 0,
            points: this.session.points,
            startAlt: this.session.points[0]?.alt || 0,
            endAlt: this.session.points[this.session.points.length - 1]?.alt || 0
        };

        this.session = null;
        return route;
    },

    async viewOnMaps(route) {
        if (!route || !route.points || route.points.length < 2) {
            alert('Percorso troppo breve per Google Maps.');
            return;
        }

        const pts = route.points;
        const origin = `${pts[0].lat},${pts[0].lng}`;
        const destination = `${pts[pts.length - 1].lat},${pts[pts.length - 1].lng}`;

        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

        window.open(url, '_system');
    }
};

export default RouteManager;
