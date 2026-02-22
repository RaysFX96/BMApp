// Static Imports for bundling
import { Geolocation } from '@capacitor/geolocation';
import { Motion } from '@capacitor/motion';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import html2canvas from 'html2canvas';
import L from 'leaflet';
import WeatherManager from './WeatherManager.js';
import NotificationManager from './NotificationManager.js';
import DocManager from './DocManager.js';
import ExportManager from './ExportManager.js';
import GarageManager from './GarageManager.js';
import RouteManager from './RouteManager.js';
import CostManager from './CostManager.js';
import ImageManager from './ImageManager.js';
import SettingsManager from './SettingsManager.js';
import GearingManager from './GearingManager.js';
import { createIcons, icons } from 'lucide';
import Chart from 'chart.js/auto';

// Global Scope Exports for Lucide and Charts
window.lucide = { createIcons, icons };
window.Chart = Chart;

// Fix Leaflet Marker Icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'images/leaflet/marker-icon-2x.png',
    iconUrl: 'images/leaflet/marker-icon.png',
    shadowUrl: 'images/leaflet/marker-shadow.png',
});

document.addEventListener('DOMContentLoaded', async () => {
    console.log('App Moto: Ripristino Totale Iniziato...');

    // --- State Management ---
    let appState = {
        user: { name: '', photo: '' },
        bikes: [],
        selectedBikeId: null,
        notificationSettings: { enabled: true, advanceDays: 7 },
        routes: [],
        documents: { patente: null, assicurazione: null, libretto: null, altro: null }
    };

    const IS_NATIVE = Capacitor.isNativePlatform();

    async function loadState() {
        try {
            const sources = [];

            // 1. Filesystem (Data) - solo su piattaforma nativa
            if (IS_NATIVE) {
                const fsData = await Filesystem.readFile({
                    path: 'appState.json',
                    directory: Directory.Data,
                    encoding: Encoding.UTF8
                }).catch(() => null);
                if (fsData && fsData.data) sources.push({ label: 'FS_DATA', data: JSON.parse(fsData.data) });
            }

            // 2. LocalStorage (sempre disponibile)
            const lsDataStr = localStorage.getItem('moto_app_v2');
            if (lsDataStr) sources.push({ label: 'LOCAL_STORAGE', data: JSON.parse(lsDataStr) });

            // 3. Native (SharedPreferences)
            if (window.AndroidFunction && window.AndroidFunction.getDataFromNative) {
                const nativeDataStr = window.AndroidFunction.getDataFromNative();
                if (nativeDataStr) sources.push({ label: 'NATIVE', data: JSON.parse(nativeDataStr) });
            }

            // 4. Filesystem (Documents - Public) - solo su piattaforma nativa
            if (IS_NATIVE) {
                const pubData = await Filesystem.readFile({
                    path: 'BikerManager_Backup.json',
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                }).catch(() => null);
                if (pubData && pubData.data) sources.push({ label: 'FS_PUBLIC', data: JSON.parse(pubData.data) });
            }

            // Logic: "Best Data Wins" -> Use the one with the most bikes
            if (sources.length > 0) {
                // Sort by bike count descending, then by timestamp if available
                sources.sort((a, b) => {
                    const countA = (a.data.bikes || []).length;
                    const countB = (b.data.bikes || []).length;
                    return countB - countA;
                });

                const bestSource = sources[0];
                console.log(`Corazzata: Scelta sorgente [${bestSource.label}] con ${bestSource.data.bikes?.length || 0} moto.`);
                Object.assign(appState, bestSource.data);
            }

            // Notifiche - solo su piattaforma nativa
            if (IS_NATIVE) {
                await NotificationManager.requestPermission().catch(() => { });
                await NotificationManager.syncNotifications(appState).catch(() => { });
            }

            // Migrations & Fallbacks
            if (!appState.bikes) appState.bikes = [];
            if (!appState.routes) appState.routes = [];
            if (!appState.user) appState.user = { name: '', photo: '' };
            if (!appState.documents) appState.documents = {};
            if (!appState.notificationSettings) appState.notificationSettings = { enabled: true, advanceDays: 7 };

            appState.bikes.forEach(b => {
                if (!b.logs) b.logs = [];
                if (!b.costs) b.costs = [];
                if (!b.maintenance) b.maintenance = {};
            });
        } catch (e) { console.error('Errore loadState:', e); }
    }

    async function saveState() {
        try {
            const stateJson = JSON.stringify(appState);

            if (IS_NATIVE) {
                await Filesystem.writeFile({
                    path: 'appState.json',
                    data: stateJson,
                    directory: Directory.Data,
                    encoding: Encoding.UTF8
                }).catch(e => console.warn('FS write failed:', e));

                await Filesystem.writeFile({
                    path: 'BikerManager_Backup.json',
                    data: stateJson,
                    directory: Directory.Documents,
                    encoding: Encoding.UTF8
                }).catch(e => console.warn('Backup pubblico non riuscito:', e));

                if (window.AndroidFunction) window.AndroidFunction.syncDataToNative(stateJson);
                await NotificationManager.syncNotifications(appState).catch(() => { });
            }

            // LocalStorage sempre (funziona anche sul web)
            localStorage.setItem('moto_app_v2', stateJson);
            console.log(`Salvataggio eseguito (${IS_NATIVE ? 'nativo + ' : ''}LocalStorage).`);
        } catch (e) { console.error('Errore saveState:', e); }
    }

    // --- Sync con Cloudflare Worker (solo PWA) ---
    const WORKER_URL = 'https://biker-manager-notifier.daviderappa96.workers.dev/sync';

    async function syncWithWorker() {
        if (IS_NATIVE) return; // Solo PWA
        const email = appState.user?.email;
        if (!email) return; // Nessuna email configurata

        const lastSync = parseInt(localStorage.getItem('bm_last_worker_sync') || '0');
        const now = Date.now();
        // if (now - lastSync < 23 * 60 * 60 * 1000) return; // Temporaneamente disabilitato per TEST

        try {
            await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, bikes: appState.bikes }),
            });
            localStorage.setItem('bm_last_worker_sync', String(now));
            console.log('Sync Worker completato per:', email);
        } catch (e) {
            console.warn('Sync Worker fallito (offline?):', e);
        }
    }

    // --- UI Helpers ---
    const refreshIcons = () => {
        try { createIcons({ icons }); } catch (e) { console.error('Errore icone:', e); }
    };
    window.refreshIcons = refreshIcons;

    // --- UI Elements ---
    const elements = {
        sidebar: document.getElementById('sidebar'),
        overlay: document.getElementById('sidebar-overlay'),
        menuBtn: document.getElementById('menu-btn'),
        navItems: document.querySelectorAll('.nav-item'),
        screens: document.querySelectorAll('.screen'),
        modal: document.getElementById('generic-modal'),
        modalTitle: document.getElementById('modal-title'),
        modalBody: document.getElementById('modal-body'),
        modalConfirm: document.getElementById('modal-confirm'),
        modalCancel: document.getElementById('modal-cancel'),
        onboardingOverlay: document.getElementById('onboarding-overlay'),
        backBtn: document.getElementById('back-btn'),
        screenTitle: document.getElementById('screen-title'),
        garageList: document.getElementById('garage-list'),
        pastRoutesList: document.getElementById('past-routes-list'),
        headerNotifBtn: document.getElementById('header-notif-btn')
    };

    let onModalConfirm = null;
    let screenHistory = [];

    // --- Weather Cache ---
    let lastWeatherUpdate = 0;
    let lastWeatherData = null;

    // --- Navigation ---
    const handleBack = () => {
        // 1. Priorità: Chiudere Modale Generica
        if (elements.modal && !elements.modal.classList.contains('hidden')) {
            elements.modal.classList.add('hidden');
            return;
        }

        // 2. Priorità: Chiudere Onboarding (se non obbligatorio, es. aggiunta moto)
        if (elements.onboardingOverlay && !elements.onboardingOverlay.classList.contains('hidden')) {
            // Se stiamo aggiungendo una moto aggiuntiva, possiamo chiudere. 
            // Se è il setup iniziale (0 moto), meglio non chiudere o gestire diversamente.
            if (appState.bikes.length > 0) {
                elements.onboardingOverlay.classList.add('hidden');
                return;
            }
        }

        // 3. Priorità: Chiudere Sidebar
        if (elements.sidebar && elements.sidebar.classList.contains('open')) {
            toggleSidebar(false);
            return;
        }

        // 4. Navigazione tra Schermate
        if (screenHistory.length > 0) {
            switchScreen(screenHistory.pop(), false);
        } else {
            if (IS_NATIVE) App.exitApp();
        }
    };

    function switchScreen(id, pushToHistory = true) {
        if (pushToHistory) {
            const current = Array.from(elements.screens).find(s => !s.classList.contains('hidden'))?.id.split('-')[1];
            if (current && current !== id) screenHistory.push(current);
        }

        elements.screens.forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(`screen-${id}`);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('active'); // CSS anim
        }

        const titles = {
            dashboard: 'Il mio Garage',
            calendar: 'Calendario',
            costs: 'Spese e Manutenzione',
            route: 'Nuovo Percorso',
            documents: 'I miei Documenti',
            gearing: 'Calcolo Rapporti',
            settings: 'Profilo Pilota',
            notifications: 'Centro Notifiche',
            'route-detail': 'Dettaglio Percorso'
        };
        if (elements.screenTitle) elements.screenTitle.innerText = titles[id] || 'App Moto';

        // Visibility adjustments
        if (elements.backBtn) elements.backBtn.classList.toggle('hidden', id === 'dashboard');
        if (elements.headerNotifBtn) elements.headerNotifBtn.classList.toggle('hidden', ['route', 'settings'].includes(id));

        // Module-specific initialization
        if (id === 'dashboard') renderGarage();
        if (id === 'calendar') renderCalendar();
        if (id === 'costs') renderCosts();
        if (id === 'settings') renderSettings();
        if (id === 'route') renderRouteList();
        if (id === 'documents') renderDocuments();
        if (id === 'gearing') renderGearing();
        if (id === 'notifications') renderNotifications();
        if (id === 'weather') renderWeeklyWeather();

        elements.navItems.forEach(nv => nv.classList.toggle('active', nv.dataset.screen === id));
        document.body.dataset.activeScreen = id;
        refreshIcons();
    }

    if (elements.backBtn) elements.backBtn.onclick = handleBack;

    // --- Listener Tasto Back Fisico (Android/Samsung) - solo nativo ---
    if (IS_NATIVE) {
        App.addListener('backButton', handleBack);
    }
    window.addEventListener('customBackButton', handleBack);
    document.addEventListener('backbutton', handleBack);

    // --- Sidebar ---
    const toggleSidebar = (open) => {
        elements.sidebar?.classList.toggle('open', open);
        elements.overlay?.classList.toggle('visible', open);
    };
    if (elements.menuBtn) elements.menuBtn.onclick = () => toggleSidebar(true);
    if (elements.overlay) elements.overlay.onclick = () => toggleSidebar(false);

    // --- Sidebar Swipe Gestures ---
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // Thresholds
        const minSwipeDist = 50;
        const maxVerticalDist = 100;
        const edgeThreshold = 40; // Pixels from left edge to trigger open

        // Check if horizontal swipe is dominant
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaY) < maxVerticalDist) {
            // Swipe Right (Open)
            if (deltaX > minSwipeDist && touchStartX < edgeThreshold) {
                toggleSidebar(true);
            }
            // Swipe Left (Close)
            else if (deltaX < -minSwipeDist && (elements.sidebar?.classList.contains('open'))) {
                toggleSidebar(false);
            }
        }
    }, { passive: true });

    elements.navItems.forEach(item => {
        item.onclick = () => {
            switchScreen(item.dataset.screen);
            toggleSidebar(false);
        };
    });

    function updateSidebarInfo() {
        const nameEl = document.getElementById('sidebar-user-name');
        if (nameEl) nameEl.innerText = appState.user.name || 'Nuovo Pilota';
        const logo = document.querySelector('.moto-logo');
        if (logo && appState.user.photo) {
            logo.innerHTML = `<img src="${appState.user.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:18px;">`;
        }
        // Mostra campo email solo su PWA (non nativa)
        const emailContainer = document.getElementById('email-field-container');
        if (emailContainer && !IS_NATIVE) {
            emailContainer.style.display = 'block';
        }
    }

    // --- Screens Logic ---
    // --- Screens Logic ---
    async function renderGarage() {
        if (appState.bikes.length === 0) {
            document.getElementById('empty-state')?.classList.remove('hidden');
            document.getElementById('dash-content')?.classList.add('hidden');
            return;
        }
        document.getElementById('empty-state')?.classList.add('hidden');
        document.getElementById('dash-content')?.classList.remove('hidden');

        // Weather Widget - Call first to avoid UI blocking
        const fetchWeather = async (force = false) => {
            const wCont = document.getElementById('weather-widget');
            if (!wCont) return;

            const now = Date.now();
            const ONE_HOUR = 3600000;

            // Use cache if not forced and less than 1 hour passed
            if (!force && lastWeatherData && (now - lastWeatherUpdate < ONE_HOUR)) {
                WeatherManager.renderWeather(wCont, lastWeatherData);
                addRefreshControl(wCont);
                return;
            }

            wCont.innerHTML = `
                <div style="display:flex; justify-content:center; align-items:center; gap:8px; opacity:0.6; font-size:13px; height:50px;">
                    <div class="spinner-small" style="width:14px; height:14px; border:2px solid rgba(255,255,255,0.2); border-top-color:var(--primary); border-radius:50%; animation: spin 0.8s linear infinite;"></div>
                    Ricerca posizione...
                </div>
            `;

            try {
                const perm = await Geolocation.checkPermissions().catch(() => null);
                if (perm?.location !== 'granted') {
                    await Geolocation.requestPermissions().catch(() => null);
                }

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('TIMEOUT_GPS')), 4500)
                );

                let pos = await Promise.race([
                    Geolocation.getCurrentPosition({ enableHighAccuracy: false }),
                    timeoutPromise
                ]).catch(() => null);

                if (!pos) {
                    pos = await Geolocation.getLastKnownLocation().catch(() => null);
                }

                if (pos && pos.coords) {
                    const data = await WeatherManager.fetchWeather(pos.coords.latitude, pos.coords.longitude);
                    if (data) {
                        lastWeatherData = data;
                        lastWeatherUpdate = Date.now();
                        WeatherManager.renderWeather(wCont, data);
                        addRefreshControl(wCont);
                        refreshIcons();

                        // Add Click to Detail
                        const clickArea = document.getElementById('weather-widget-click');
                        if (clickArea) {
                            clickArea.onclick = () => switchScreen('weather');
                        }
                    } else {
                        throw new Error('WEATHER_DATA_NULL');
                    }
                } else {
                    throw new Error('NO_POSITION');
                }
            } catch (err) {
                console.error('Weather error:', err);
                wCont.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; height:50px;">
                        <span style="opacity:0.5; font-size:12px;">Meteo non disponibile</span>
                        <button id="retry-weather" class="btn-text" style="font-size:12px; color:var(--primary); padding:8px;">RIPROVA</button>
                    </div>
                `;
                const rBtn = document.getElementById('retry-weather');
                if (rBtn) rBtn.onclick = () => fetchWeather(true);
            }
        };

        function addRefreshControl(wCont) {
            const refreshBtn = document.createElement('div');
            refreshBtn.style = "position:absolute; top:0; right:0; padding:12px; cursor:pointer; opacity:0.4;";
            refreshBtn.innerHTML = '<i data-lucide="refresh-cw" style="width:14px;"></i>';
            refreshBtn.onclick = (e) => { e.stopPropagation(); fetchWeather(true); };
            wCont.style.position = 'relative';
            wCont.appendChild(refreshBtn);
        }

        fetchWeather();

        await GarageManager.renderGarage(elements.garageList, appState.bikes, (bike) => {
            appState.selectedBikeId = bike.id;
            switchScreen('calendar');
        }, (bike) => {
            GarageManager.editBike(bike, (t, b, cb) => openModal(t, b, cb), {
                onSave: async () => { await saveState(); renderGarage(); },
                onPhotoChange: (file) => {
                    const reader = new FileReader();
                    reader.onload = async (e) => { bike.photo = e.target.result; await saveState(); renderGarage(); };
                    reader.readAsDataURL(file);
                },
                onDelete: async () => {
                    if (confirm('Rimuovere ' + bike.model + ' dal garage?')) {
                        appState.bikes = appState.bikes.filter(x => x.id !== bike.id);
                        await saveState();
                        renderGarage();
                        elements.modal?.classList.add('hidden');
                    }
                }
            });
        });
    }

    function renderWeeklyWeather() {
        const list = document.getElementById('weather-weekly-list');
        const loc = document.getElementById('weather-detail-loc');
        if (!list || !lastWeatherData) return;

        if (loc) loc.innerText = "Previsioni per i prossimi 7 giorni";
        WeatherManager.renderWeeklyForecast(list, lastWeatherData);
        refreshIcons();
    }

    function renderCalendar() {
        const bike = appState.bikes.find(b => b.id === appState.selectedBikeId) || appState.bikes[0];
        const container = document.getElementById('calendar-view');
        const selectorCont = document.getElementById('cal-bike-selector-cont');
        if (!bike || !container) return;

        // Gestione Selettore Moto nel Calendario
        if (selectorCont) {
            selectorCont.innerHTML = `
                <div class="input-group" style="margin-bottom:0;">
                    <label style="display:block; font-size:12px; color:#888; margin-bottom:8px; font-weight:600; text-transform:uppercase;">Seleziona Moto</label>
                    <select id="cal-bike-selector" style="width:100%; padding:14px 16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff; font-size:15px; cursor:pointer;">
                        ${appState.bikes.map(b => `<option value="${b.id}" ${b.id === bike.id ? 'selected' : ''}>${b.model}</option>`).join('')}
                    </select>
                </div>
            `;
            const sel = document.getElementById('cal-bike-selector');
            if (sel) {
                sel.onchange = (e) => {
                    appState.selectedBikeId = e.target.value;
                    renderCalendar();
                };
            }
        }

        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const startDay = new Date(y, m, 1).getDay();
        const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

        let html = `<div style="background:var(--primary); padding:16px; border-radius:20px 20px 0 0; text-align:center;">
                        <h3 style="margin:0; font-size:18px;">${monthNames[m]} ${y}</h3>
                        <p style="margin:4px 0 0; font-size:12px; opacity:0.8;">${bike.model} - Registro Manutenzioni</p>
                    </div>
                    <div style="display:grid; grid-template-columns: repeat(7, 1fr); background:rgba(255,255,255,0.03); border-radius:0 0 20px 20px; padding:8px;">
                        ${['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(d => `<div style="text-align:center; padding:8px; font-size:11px; color:#666; font-weight:700;">${d}</div>`).join('')}`;

        let emptyDays = startDay === 0 ? 6 : startDay - 1;
        for (let i = 0; i < emptyDays; i++) html += `<div></div>`;
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hasEvent = bike.logs.some(l => l.date === dateStr);
            html += `<div class="cal-day" style="background:${hasEvent ? 'rgba(255, 59, 48, 0.2)' : 'transparent'};" data-date="${dateStr}">
                        ${d}
                        ${hasEvent ? '<div style="width:4px; height:4px; background:var(--primary); border-radius:50%; margin-top:2px;"></div>' : ''}
                     </div>`;
        }
        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.cal-day').forEach(el => {
            el.onclick = () => {
                const date = el.dataset.date;
                const body = `
                    <div class="input-group"><label>Tipo di Intervento</label><select id="log-type">
                        <option value="Assicurazione">Assicurazione</option>
                        <option value="Bollo">Bollo</option>
                        <option value="Revisione">Revisione</option>
                        <option value="Tagliando">Tagliando</option>
                        <option value="Gomme">Gomme</option>
                        <option value="Freni">Freni</option>
                        <option value="Refrigerante">Refrigerante</option>
                        <option value="Liquido Freni">Liquido Freni</option>
                        <option value="Trasmissione">Trasmissione</option>
                        <option value="Carburante">Carburante</option>
                        <option value="Altro">Altro</option>
                    </select></div>
                    <div class="input-group"><label>KM della Moto</label><input type="number" id="log-km" value="${bike.currentKm}"></div>
                    <div class="input-group"><label>Costo Sostenuto (€)</label><input type="number" id="log-cost" step="0.01" value="0"></div>
                `;
                openModal('Nuovo Record: ' + date, body, async () => {
                    const lType = document.getElementById('log-type').value;
                    const lKm = parseInt(document.getElementById('log-km').value) || 0;
                    const lCost = parseFloat(document.getElementById('log-cost').value) || 0;
                    bike.logs.push({ type: lType, km: lKm, date, cost: lCost });
                    bike.currentKm = Math.max(bike.currentKm, lKm);

                    // --- RESET NOTIFICHE MANUTENZIONE ---
                    const typeMap = {
                        'Assicurazione': 'assicurazione',
                        'Bollo': 'bollo',
                        'Revisione': 'revisione',
                        'Tagliando': 'tagliando',
                        'Gomme': 'gomme',
                        'Freni': 'freni',
                        'Refrigerante': 'refrigerante',
                        'Liquido Freni': 'liquido_freni',
                        'Trasmissione': 'trasmissione'
                    };
                    const maintCat = typeMap[lType];
                    if (maintCat) {
                        if (!bike.maintenance[maintCat]) bike.maintenance[maintCat] = {};
                        // Aggiorna solo se la data è più recente di quella salvata (evita pasticci con record storici)
                        const currentLastDate = bike.maintenance[maintCat].lastDate;
                        if (!currentLastDate || new Date(date) >= new Date(currentLastDate)) {
                            bike.maintenance[maintCat].lastDate = date;
                            bike.maintenance[maintCat].lastKm = lKm;
                        }
                    }

                    if (lCost > 0) bike.costs.push({ desc: lType, amount: lCost, month: m, year: y });
                    await saveState();
                    renderCalendar();
                });
            };
        });

        // List Logs Below
        const logsCont = document.getElementById('logs-list');
        if (logsCont) {
            logsCont.innerHTML = bike.logs.length === 0 ? '<div style="text-align:center; padding:32px; opacity:0.4;">Nessun intervento registrato.</div>' : '';
            bike.logs.slice().reverse().forEach((log, revIdx) => {
                const realIdx = bike.logs.length - 1 - revIdx;
                const card = document.createElement('div');
                card.className = 'bike-card';
                card.style.padding = '14px';
                card.innerHTML = `
                    <div style="width:44px; height:44px; border-radius:12px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; color:var(--primary);">
                        <i data-lucide="wrench" style="width:20px;"></i>
                    </div>
                    <div style="flex-grow:1;">
                        <div style="display:flex; justify-content:space-between; align-items:start;">
                            <h5 style="margin:0; font-size:15px;">${log.type}</h5>
                            <span style="font-size:11px; opacity:0.5;">${log.date}</span>
                        </div>
                        <p style="font-size:13px; margin:2px 0 0;">${log.km.toLocaleString()} KM ${log.cost > 0 ? `\u2022 € ${log.cost.toFixed(2)}` : ''}</p>
                    </div>
                    <button class="btn-delete-log btn btn-text" style="color:#ff3b30; width:40px; height:40px; padding:0;">
                        <i data-lucide="trash-2" style="width:18px;"></i>
                    </button>
                `;

                card.querySelector('.btn-delete-log').onclick = async () => {
                    if (confirm(`Eliminare questo intervento (${log.type})?`)) {
                        // Rimuovi dal log
                        bike.logs.splice(realIdx, 1);

                        // Rimuovi dai costi se associato
                        if (log.cost > 0) {
                            const d = new Date(log.date);
                            const cIdx = bike.costs.findIndex(c =>
                                c.desc === log.type &&
                                c.amount === log.cost &&
                                c.year === d.getFullYear() &&
                                c.month === d.getMonth()
                            );
                            if (cIdx !== -1) bike.costs.splice(cIdx, 1);
                        }

                        await saveState();
                        renderCalendar();
                    }
                };

                logsCont.appendChild(card);
            });
        }
        refreshIcons();

        // Export button handler
        const exportBtn = document.getElementById('export-logs-btn');
        if (exportBtn) {
            exportBtn.onclick = () => ExportManager.exportMaintenanceLogs(bike);
        }
    }

    function renderCosts() {
        console.log('Rendering Costs Screen...');
        const bike = appState.bikes.find(b => b.id === appState.selectedBikeId) || appState.bikes[0];
        const list = document.getElementById('costs-list');
        const canvas = document.getElementById('costsChart');
        const totalEl = document.getElementById('year-total');
        const addBtn = document.getElementById('add-cost-btn');
        const selectorCont = document.getElementById('costs-bike-selector-cont');

        console.log('Current Bike for costs:', bike ? bike.model : 'None');

        // Se non ci sono moto, resetta l'interfaccia e ritorna
        if (!bike && appState.selectedBikeId !== 'all') {
            console.warn('No bike found for costs, showing empty state.');
            if (list) list.innerHTML = '<div class="empty-state">Aggiungi una moto per vedere le spese.</div>';
            if (totalEl) totalEl.innerText = '€ 0.00';
            if (selectorCont) selectorCont.innerHTML = '';
            return;
        }

        // Gestione Selettore Moto nei Costi
        if (selectorCont) {
            selectorCont.innerHTML = `
                <div class="input-group" style="margin-bottom:0;">
                    <label style="display:block; font-size:12px; color:#888; margin-bottom:8px; font-weight:600; text-transform:uppercase;">Seleziona Moto</label>
                    <select id="costs-bike-selector" style="width:100%; padding:14px 16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff; font-size:15px; cursor:pointer;">
                        <option value="all" ${appState.selectedBikeId === 'all' ? 'selected' : ''}>Tutte le Moto</option>
                        ${appState.bikes.map(b => `<option value="${b.id}" ${b.id === bike.id && appState.selectedBikeId !== 'all' ? 'selected' : ''}>${b.model}</option>`).join('')}
                    </select>
                </div>
            `;
            const sel = document.getElementById('costs-bike-selector');
            if (sel) {
                sel.onchange = (e) => {
                    appState.selectedBikeId = e.target.value;
                    renderCosts();
                };
            }
        }

        // Hide add button as requested (costs only via calendar)
        if (addBtn) addBtn.style.display = 'none';

        const filterBikes = appState.selectedBikeId === 'all' ? appState.bikes : [bike];

        const sum = CostManager.renderList(list, filterBikes, async (targetBike, costIndex) => {
            if (confirm('Eliminare questa spesa?')) {
                targetBike.costs.splice(costIndex, 1);
                await saveState();
                renderCosts();
            }
        });

        if (totalEl) totalEl.innerText = `€ ${sum.toFixed(2)}`;
        if (canvas) CostManager.renderChart(canvas, filterBikes);
        refreshIcons();
    }

    function renderSettings() {
        SettingsManager.renderSettings(document.getElementById('screen-settings'), appState, {
            onSave: async () => {
                appState.user.name = document.getElementById('st-user-name').value;
                const emailInp = document.getElementById('st-user-email');
                if (emailInp && !IS_NATIVE) appState.user.email = emailInp.value.trim();
                appState.notificationSettings.enabled = document.getElementById('st-notif-enabled').checked;
                appState.notificationSettings.advanceDays = parseInt(document.getElementById('st-notif-days').value) || 7;
                await saveState();
                // Reset sync timer se email è cambiata, per forzare un nuovo sync
                if (!IS_NATIVE) localStorage.removeItem('bm_last_worker_sync');
                await syncWithWorker();
                updateSidebarInfo();
                alert('Profilo aggiornato con successo!');
            },
            onPhotoChange: (file) => {
                const r = new FileReader();
                r.onload = async (e) => { appState.user.photo = e.target.result; await saveState(); updateSidebarInfo(); renderSettings(); };
                r.readAsDataURL(file);
            },
            onReset: async () => {
                if (confirm('Attenzione: vuoi formattare TUTTI i dati dell\'app?')) {
                    try {
                        localStorage.clear();
                        await Filesystem.deleteFile({ path: 'appState.json', directory: Directory.Data }).catch(() => null);
                        await Filesystem.deleteFile({ path: 'BikerManager_Backup.json', directory: Directory.Documents }).catch(() => null);
                        if (window.AndroidFunction) window.AndroidFunction.syncDataToNative('');
                    } catch (e) { console.error('Dettaglio reset:', e); }
                    location.reload();
                }
            }
        });
        refreshIcons();
    }

    function renderDocuments() {
        try {
            console.log('--- START renderDocuments ---');
            const bike = appState.bikes.find(b => b.id === appState.selectedBikeId) || appState.bikes[0];
            const selectorCont = document.getElementById('docs-bike-selector-cont');
            console.log('Bike selected:', bike ? bike.model : 'NONE');

            if (selectorCont) {
                if (appState.bikes.length > 0 && bike) {
                    selectorCont.innerHTML = `
                        <div class="input-group" style="margin-bottom:0;">
                            <label style="display:block; font-size:12px; color:#888; margin-bottom:8px; font-weight:600; text-transform:uppercase;">Seleziona Moto</label>
                            <select id="docs-bike-selector" style="width:100%; padding:14px 16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff; font-size:15px; cursor:pointer;">
                                ${appState.bikes.map(b => `<option value="${b.id}" ${b.id === bike.id ? 'selected' : ''}>${b.model}</option>`).join('')}
                            </select>
                        </div>
                    `;
                    const sel = document.getElementById('docs-bike-selector');
                    if (sel) {
                        sel.onchange = (e) => {
                            appState.selectedBikeId = e.target.value;
                            renderDocuments();
                        };
                    }
                } else {
                    selectorCont.innerHTML = '';
                    console.log('Zero bikes found or bike null.');
                }
            }

            if (bike && !bike.documents) bike.documents = {};

            const slots = ['patente', 'assicurazione', 'libretto', 'altro'];
            slots.forEach(s => {
                try {
                    console.log('Processing slot:', s);
                    const preview = document.getElementById(`doc-preview-${s}`);
                    const input = document.getElementById(`input-doc-${s}`);

                    if (!preview) {
                        console.error('Missing preview element for slot:', s);
                        return;
                    }

                    const isGlobal = s === 'patente';
                    const docSource = isGlobal ? appState.documents : (bike ? bike.documents : null);
                    const docFile = docSource ? docSource[s] : null;

                    const card = preview.closest('.doc-card');
                    if (card) {
                        card.style.opacity = (isGlobal || bike) ? '1' : '0.4';
                    }

                    preview.innerHTML = `<i data-lucide="${s === 'patente' ? 'credit-card' : s === 'assicurazione' ? 'shield' : s === 'libretto' ? 'file-text' : 'paperclip'}" style="width:24px; color:#666;"></i>`;

                    if (docFile) {
                        console.log('Loading file preview for:', s, docFile);
                        DocManager.getDocSrc(docFile).then(src => {
                            if (preview && src) preview.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:contain;">`;
                        });
                    }

                    if (input) {
                        input.onchange = (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async (ev) => {
                                try {
                                    const base64 = ev.target.result;
                                    const filename = await DocManager.saveDoc(base64, s);
                                    docSource[s] = filename;
                                    await saveState();
                                    renderDocuments();
                                } catch (err) { console.error('Error saving doc:', err); }
                            };
                            reader.readAsDataURL(file);
                        };
                    }
                } catch (slotErr) {
                    console.error('Error in slot loop for:', s, slotErr);
                }
            });
            console.log('--- END renderDocuments ---');
            refreshIcons();
        } catch (err) {
            console.error('FATAL Error in renderDocuments:', err);
        }
    }

    function renderGearing() {
        const btn = document.getElementById('calc-gears-btn');
        const results = document.getElementById('gearing-results');
        const table = document.getElementById('gear-table');
        const rpmLabel = document.getElementById('res-rpm');

        // Import Logic
        const makeSel = document.getElementById('import-gear-make');
        const modelSel = document.getElementById('import-gear-model');
        const importBtn = document.getElementById('btn-import-gear');

        if (makeSel && modelSel) {
            makeSel.onchange = () => {
                const models = GearingManager.getModels(makeSel.value);
                modelSel.innerHTML = '<option value="">Scegli Modello...</option>' +
                    models.map(m => `<option value="${m.model}">${m.model}</option>`).join('');
            };

            importBtn.onclick = () => {
                const data = GearingManager.findData(makeSel.value, modelSel.value);
                if (data) {
                    document.getElementById('gear-sprocket').value = data.sprocket;
                    document.getElementById('gear-chainring').value = data.chainring;
                    document.getElementById('gear-tyre').value = data.tyre;
                    document.getElementById('gear-primary').value = data.primary;
                    data.gears.forEach((r, i) => {
                        const el = document.getElementById(`gear-r${i + 1}`);
                        if (el) el.value = r;
                    });
                    alert('Dati importati per: ' + data.model);
                } else {
                    alert('Seleziona Marca e Modello per importare i dati.');
                }
            };
        }

        if (!btn || !results || !table) return;

        btn.onclick = () => {
            const front = parseFloat(document.getElementById('gear-sprocket').value) || 16;
            const rear = parseFloat(document.getElementById('gear-chainring').value) || 44;
            const tyre = parseFloat(document.getElementById('gear-tyre').value) || 2000;
            const primary = parseFloat(document.getElementById('gear-primary').value) || 1.6;
            const rpm = parseFloat(document.getElementById('gear-rpm').value) || 10000;

            const ratios = [
                parseFloat(document.getElementById('gear-r1').value) || 1,
                parseFloat(document.getElementById('gear-r2').value) || 1,
                parseFloat(document.getElementById('gear-r3').value) || 1,
                parseFloat(document.getElementById('gear-r4').value) || 1,
                parseFloat(document.getElementById('gear-r5').value) || 1,
                parseFloat(document.getElementById('gear-r6').value) || 1
            ];

            const finalDrive = rear / front;
            rpmLabel.innerText = rpm;
            table.innerHTML = '';

            ratios.forEach((r, i) => {
                const totalReduction = primary * r * finalDrive;
                // Speed (km/h) = (RPM * Circonferenza_mm * 60) / (Riduzione * 1.000.000)
                const speed = (rpm * tyre * 60) / (totalReduction * 1000000);

                const card = document.createElement('div');
                card.style.cssText = 'background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); display:flex; flex-direction:column; align-items:center;';
                card.innerHTML = `
                    <span style="font-size:10px; color:#aaa; text-transform:uppercase; font-weight:700;">${i + 1}ª Marcia</span>
                    <span style="font-size:20px; font-weight:800; color:var(--primary);">${speed.toFixed(1)} <small style="font-size:10px; opacity:0.6;">km/h</small></span>
                    <span style="font-size:9px; opacity:0.4; margin-top:2px;">Rapp: ${r.toFixed(3)}</span>
                `;
                table.appendChild(card);
            });

            results.classList.remove('hidden');
            results.scrollIntoView({ behavior: 'smooth' });
        };
    }

    function renderNotifications() {
        const list = document.getElementById('notifications-list');
        if (!list) return;
        list.innerHTML = '';

        const alerts = [];
        const advanceDays = appState.notificationSettings?.advanceDays || 15;

        appState.bikes.forEach(bike => {
            const maintenanceTypes = {
                assicurazione: { label: 'Assicurazione', icon: 'shield' },
                bollo: { label: 'Bollo', icon: 'file-text' },
                revisione: { label: 'Revisione', icon: 'clipboard-check' },
                tagliando: { label: 'Tagliando', icon: 'wrench' },
                gomme: { label: 'Gomme', icon: 'circle' },
                freni: { label: 'Freni', icon: 'octagon' },
                refrigerante: { label: 'Liquido Refrigerante', icon: 'droplet' },
                liquido_freni: { label: 'Liquido Freni', icon: 'droplet' },
                trasmissione: { label: 'Trasmissione', icon: 'settings' }
            };

            Object.entries(maintenanceTypes).forEach(([key, config]) => {
                const m = bike.maintenance[key];
                if (!m || !m.lastDate) return;

                let expired = false;
                let reason = '';
                let daysRemaining = 999;

                // 1. Time Calculation
                const lastDate = new Date(m.lastDate);
                const intervalMonths = m.intervalMonths || 12;
                const nextDate = new Date(lastDate);
                nextDate.setMonth(nextDate.getMonth() + intervalMonths);

                daysRemaining = Math.ceil((nextDate - new Date()) / 86400000);

                if (daysRemaining <= advanceDays) {
                    expired = true;
                    reason = daysRemaining < 0 ? `Scaduto da ${Math.abs(daysRemaining)} giorni` : `Scade tra ${daysRemaining} giorni`;
                }

                // 2. Kilometers Calculation (if applicable)
                if (m.intervalKm > 0) {
                    const lastKm = m.lastKm || 0;
                    const kmSince = bike.currentKm - lastKm;
                    const kmRemaining = m.intervalKm - kmSince;

                    // Priority to Km if they are closer to expiration than time
                    if (kmRemaining < 1000) { // Notify 1000km before
                        expired = true;
                        const kmStatus = kmRemaining < 0 ? `Superato di ${Math.abs(kmRemaining)} km` : `Mancano ${kmRemaining} km`;
                        // If time is also critical, show both or pick the most urgent
                        if (daysRemaining > 0 && kmRemaining < 500) {
                            reason = kmStatus;
                        } else if (kmRemaining < 0) {
                            reason = kmStatus;
                        }
                    }
                }

                if (expired) {
                    alerts.push({
                        bike: bike.model,
                        type: config.label,
                        icon: config.icon,
                        reason,
                        daysRemaining, // used for sorting
                        severity: (daysRemaining < 0 || (m.intervalKm > 0 && (bike.currentKm - m.lastKm) > m.intervalKm)) ? 'critical' : 'warning'
                    });
                }
            });
        });

        if (alerts.length === 0) {
            list.innerHTML = `
            <div style="text-align:center; padding:60px 20px;">
                <i data-lucide="check-circle" style="width:64px; height:64px; color:var(--ok); margin-bottom:16px;"></i>
                <h3 style="font-size:18px; margin:0 0 8px 0; font-weight:600;">Tutto in Ordine</h3>
                <p style="font-size:14px; opacity:0.6; margin:0;">Nessuna manutenzione in scadenza.</p>
            </div>
        `;
        } else {
            alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
            alerts.forEach(alert => {
                const severityColors = {
                    critical: { bg: 'rgba(255, 69, 58, 0.1)', border: '#ff453a', text: '#ff453a' },
                    warning: { bg: 'rgba(255, 159, 10, 0.1)', border: '#ff9f0a', text: '#ff9f0a' }
                };
                const colors = severityColors[alert.severity] || severityColors.warning;

                const card = document.createElement('div');
                card.style.cssText = `
                background: ${colors.bg};
                border: 1px solid ${colors.border};
                border-radius: 16px;
                padding: 16px;
                margin-bottom: 12px;
                display: flex;
                gap: 14px;
                align-items: center;
                animation: fadeIn 0.3s ease-out;
            `;
                card.innerHTML = `
                <div style="width:44px; height:44px; background:rgba(255,255,255,0.05); border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <i data-lucide="${alert.icon}" style="width:22px; height:22px; color:${colors.text};"></i>
                </div>
                <div style="flex-grow:1; min-width:0;">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div style="font-weight:700; font-size:15px; color:#fff;">${alert.type}</div>
                        <span style="font-size:10px; font-weight:800; text-transform:uppercase; padding:2px 8px; border-radius:4px; background:${colors.text}; color:#000;">${alert.severity}</span>
                    </div>
                    <div style="font-size:13px; opacity:0.7; margin-top:2px; color:#fff;">${alert.bike}</div>
                    <div style="font-size:13px; font-weight:600; color:${colors.text}; margin-top:4px;">${alert.reason}</div>
                </div>
            `;
                list.appendChild(card);
            });
        }

        if (window.refreshIcons) window.refreshIcons();
    }

    function renderRouteList() {
        const list = document.getElementById('past-routes-list');
        if (list) {
            list.innerHTML = appState.routes.length === 0 ? '<div style="opacity:0.4; font-size:12px; margin-top:20px; text-align:center;">Nessun percorso registrato.</div>' : '';
            appState.routes.slice().reverse().forEach(r => {
                const card = document.createElement('div');
                card.className = 'route-history-card';
                card.innerHTML = `
                    <div class="rh-header">
                        <div class="rh-date">Uscita del ${new Date(r.date).toLocaleDateString()}</div>
                        <div class="btn-share-trigger" style="padding: 12px; margin: -12px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="share-2" style="width:18px; color:var(--primary);"></i>
                        </div>
                    </div>
                    <div class="rh-stats-row">
                        <div class="rh-stat-item">
                            <i data-lucide="zap"></i>
                            <span>Max: <b>${r.maxSpeed}</b> km/h</span>
                        </div>
                        <div class="rh-stat-item">
                            <i data-lucide="clock"></i>
                            <span>Tempo: <b>${Math.floor(r.duration / 60)}m ${r.duration % 60}s</b></span>
                        </div>
                    </div>
                    <div class="rh-stats-row">
                        <div class="rh-stat-item">
                            <i data-lucide="trending-down"></i>
                            <span>Piega: <b>L ${r.maxLeanL}° | R ${r.maxLeanR}°</b></span>
                        </div>
                        <div class="rh-stat-item">
                            <i data-lucide="map-pin"></i>
                            <span>KM: <b>${r.totalDist || '0.00'}</b></span>
                        </div>
                    </div>
                    <div class="rh-actions" style="margin-top:10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <button class="btn btn-text btn-view-maps" style="font-size:11px; padding:6px; opacity:0.8; display:flex; align-items:center; justify-content:center; gap:4px;">
                            <i data-lucide="map" style="width:12px;"></i> VEDI SU MAPS
                        </button>
                        <button class="btn btn-text btn-delete-route" style="font-size:11px; padding:6px; color:var(--error); opacity:0.8; display:flex; align-items:center; justify-content:center; gap:4px;">
                            <i data-lucide="trash-2" style="width:12px;"></i> ELIMINA
                        </button>
                    </div>
                `;

                // Header Icon Wrapper -> Share/Detail ONLY
                const shareBtn = card.querySelector('.btn-share-trigger');
                if (shareBtn) {
                    shareBtn.onclick = (e) => {
                        e.stopPropagation();
                        showRouteDetail(r);
                    };
                }

                // Maps Action
                card.querySelector('.btn-view-maps').onclick = (e) => {
                    e.stopPropagation();
                    RouteManager.viewOnMaps(r);
                };

                card.querySelector('.btn-delete-route').onclick = async (e) => {
                    e.stopPropagation();
                    if (confirm('Vuoi eliminare definitivamente questo percorso?')) {
                        appState.routes = appState.routes.filter(route => route.id !== r.id);
                        await saveState();
                        renderRouteList();
                    }
                };

                list.appendChild(card);
            });
        }

        document.getElementById('start-route-btn').onclick = async () => {
            try {
                const session = await RouteManager.startRecording({
                    onSpeed: (s) => {
                        const el = document.getElementById('live-speed');
                        if (el) el.innerText = s;
                    },
                    onAlt: (a) => {
                        const el = document.getElementById('live-alt');
                        if (el) el.innerText = a;
                    },
                    onLean: (angle, maxL, maxR) => {
                        const icon = document.getElementById('lean-moto-container');
                        if (icon) icon.style.transform = `rotate(${angle}deg)`;
                        const liveEl = document.getElementById('live-lean');
                        const maxLEl = document.getElementById('max-lean-left');
                        const maxREl = document.getElementById('max-lean-right');
                        if (liveEl) liveEl.innerText = `${Math.abs(angle)}°`;
                        if (maxLEl) maxLEl.innerText = `${maxL}°`;
                        if (maxREl) maxREl.innerText = `${maxR}°`;
                    },
                    onAccel: (g) => {
                        const el = document.getElementById('accel-value');
                        if (el) el.innerText = g.toFixed(1);
                    },
                    onDist: (d) => {
                        const el = document.getElementById('live-dist');
                        if (el) el.innerText = d.toFixed(2);
                    }
                });

                document.getElementById('route-idle').classList.add('hidden');
                document.getElementById('route-active').classList.remove('hidden');

                const timerInt = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
                    const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
                    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
                    const s = (elapsed % 60).toString().padStart(2, '0');
                    const timerEl = document.getElementById('route-timer');
                    if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
                }, 1000);

                document.getElementById('stop-route-btn').onclick = async () => {
                    clearInterval(timerInt);
                    const routeResult = await RouteManager.stopRecording();
                    if (routeResult) {
                        appState.routes.push(routeResult);
                        await saveState();
                    }
                    document.getElementById('route-active').classList.add('hidden');
                    document.getElementById('route-idle').classList.remove('hidden');
                    renderRouteList();
                };
            } catch (err) {
                alert('Errore GPS/Sensori: ' + err.message);
            }
        };
        refreshIcons();
    }

    let detailMap = null;
    async function showRouteDetail(r) {
        switchScreen('route-detail');
        document.getElementById('share-date').innerText = new Date(r.date).toLocaleDateString();
        document.getElementById('detail-speed').innerText = r.maxSpeed;
        document.getElementById('detail-dist').innerText = r.totalDist || '0.00';
        const dur = r.duration || 0;
        const durText = dur < 3600
            ? `${Math.floor(dur / 60)}m ${dur % 60}s`
            : `${Math.floor(dur / 3600)}h ${Math.floor((dur % 3600) / 60)}m`;
        document.getElementById('detail-duration').innerText = durText;
        document.getElementById('detail-avg-speed').innerText = r.avgSpeed || '0';
        document.getElementById('detail-lean-l').innerText = r.maxLeanL;
        document.getElementById('detail-lean-r').innerText = r.maxLeanR;
        document.getElementById('detail-accel-val').innerText = r.maxAccel || '0.0';
        document.getElementById('detail-alt-start').innerText = typeof r.startAlt === 'number' ? r.startAlt.toFixed(2) : (r.startAlt || '0');

        // Map Initialization
        setTimeout(() => {
            if (detailMap) {
                detailMap.off();
                detailMap.remove();
            }
            detailMap = L.map('map-container', { zoomControl: false, attributionControl: false }).setView([r.points[0]?.lat || 0, r.points[0]?.lng || 0], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(detailMap);

            if (r.points && r.points.length > 1) {
                const polyline = L.polyline(r.points.map(p => [p.lat, p.lng]), { color: 'var(--primary)', weight: 4 }).addTo(detailMap);
                detailMap.fitBounds(polyline.getBounds(), { padding: [10, 10] });
            }
        }, 300);

        // Share Handler
        document.getElementById('export-share-btn').onclick = async () => {
            const area = document.getElementById('capture-area');
            try {
                const canvas = await html2canvas(area, {
                    useCORS: true,
                    backgroundColor: null,
                    scale: 2
                });
                const base64 = canvas.toDataURL('image/png');

                // Save and share
                const fileName = `percorso_${Date.now()}.png`;
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: base64.split(',')[1],
                    directory: Directory.Cache
                });

                await Share.share({
                    title: 'Il mio Giro in Moto',
                    text: `Ho percorso ${r.totalDist} km con la mia app Biker Manager!`,
                    url: savedFile.uri,
                    dialogTitle: 'Condividi il tuo percorso'
                });
            } catch (err) {
                alert('Errore condivisione: ' + err.message);
            }
        };

        // Export GPX (hidden functionality available via console or if needed)
        document.getElementById('export-gpx-btn').onclick = () => {
            ExportManager.exportToGPX(r);
        };

        switchScreen('route-detail');
    }

    // --- Modal Handler ---
    function openModal(title, body, confirmCb) {
        if (!elements.modal) return;
        elements.modalTitle.innerText = title;
        elements.modalBody.innerHTML = body;
        elements.modal.classList.remove('hidden');
        onModalConfirm = confirmCb;
    }
    if (elements.modalCancel) elements.modalCancel.onclick = () => elements.modal.classList.add('hidden');
    if (elements.modalConfirm) elements.modalConfirm.onclick = async () => {
        if (onModalConfirm) await onModalConfirm();
        elements.modal.classList.add('hidden');
    };

    // --- Onboarding Logic ---
    let tempBImage = '';
    let tempM = {};
    let isAddingNewBike = false; // flag: true quando si aggiunge una moto aggiuntiva

    const nextS = (step) => {
        document.querySelectorAll('.onboarding-form').forEach(f => f.classList.add('hidden'));
        document.getElementById(`step-${step}`)?.classList.remove('hidden');
        document.querySelectorAll('.step-dot').forEach((d, i) => d.classList.toggle('active', i < step));
    };

    // Funzione per resettare i campi dell'onboarding moto
    const resetBikeOnboarding = () => {
        tempBImage = '';
        tempM = {};
        const modelEl = document.getElementById('moto-model');
        const kmEl = document.getElementById('current-km-total');
        const previewEl = document.getElementById('moto-img-preview');
        const maintCont = document.getElementById('maint-inputs-cont');
        const maintSel = document.getElementById('maint-selector');
        const summaryList = document.getElementById('maint-summary-list');
        if (modelEl) modelEl.value = '';
        if (kmEl) kmEl.value = '';
        if (previewEl) previewEl.innerHTML = '<i data-lucide="bike" style="width: 50px; height: 50px; color: #888;"></i>';
        if (maintCont) { maintCont.style.display = 'none'; maintCont.innerHTML = ''; }
        if (maintSel) maintSel.value = '';
        if (summaryList) summaryList.innerHTML = '';
        refreshIcons();
    };

    document.getElementById('maint-selector')?.addEventListener('change', (e) => {
        const cat = e.target.value;
        const cont = document.getElementById('maint-inputs-cont');
        if (!cont) return;

        // Default intervals based on user requests
        const defaults = {
            assicurazione: { m: 12, k: 0 },
            bollo: { m: 12, k: 0 },
            revisione: { m: 24, k: 0 },
            tagliando: { m: 12, k: 10000 },
            gomme: { m: 36, k: 15000 },
            freni: { m: 24, k: 20000 },
            refrigerante: { m: 24, k: 30000 },
            liquido_freni: { m: 24, k: 20000 },
            trasmissione: { m: 12, k: 20000 }
        };
        const def = defaults[cat] || { m: 12, k: 10000 };
        const isKmRelated = !['assicurazione', 'bollo', 'revisione'].includes(cat);

        cont.style.display = 'block';
        cont.innerHTML = `
            <h5 style="margin-top:0; color:var(--primary);">${cat.toUpperCase()}</h5>
            <div class="input-group">
                <label>Data Ultimo Intervento</label>
                <input type="date" id="ot-date">
            </div>
            <div class="input-group">
                <label>Frequenza (Mesi)</label>
                <input type="number" id="ot-int-m" value="${def.m}">
            </div>
            ${isKmRelated ? `
                <div class="input-group">
                    <label>Km Ultimo Intervento</label>
                    <input type="number" id="ot-km" placeholder="Es: 15000">
                </div>
                <div class="input-group">
                    <label>Frequenza (Km)</label>
                    <input type="number" id="ot-int-k" value="${def.k}">
                </div>
            ` : ''}
            <div style="text-align: center;">
                <button id="ot-save" class="btn btn-primary" style="margin-top: 24px;">SALVA CONFIGURAZIONE</button>
            </div>
        `;

        document.getElementById('ot-save').onclick = () => {
            const lastDate = document.getElementById('ot-date').value;
            const intM = parseInt(document.getElementById('ot-int-m').value) || 0;
            const lastKm = isKmRelated ? (parseInt(document.getElementById('ot-km').value) || 0) : 0;
            const intK = isKmRelated ? (parseInt(document.getElementById('ot-int-k').value) || 0) : 0;

            if (!lastDate) { alert('Inserisci almeno la data!'); return; }

            tempM[cat] = { lastDate, lastKm, intervalMonths: intM, intervalKm: intK };

            // Aggiorna il riepilogo visivo
            const summaryList = document.getElementById('maint-summary-list');
            if (summaryList) {
                const existing = summaryList.querySelector(`[data-cat="${cat}"]`);
                if (existing) existing.remove();

                const item = document.createElement('div');
                item.dataset.cat = cat;
                item.style.cssText = 'background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(255,255,255,0.05);';
                item.innerHTML = `
                    <span style="font-weight:600; text-transform:capitalize;">${cat.replace('_', ' ')}</span>
                    <span style="font-size:11px; opacity:0.6;">${new Date(lastDate).toLocaleDateString()} ${isKmRelated ? `| ${lastKm} km` : ''}</span>
                    <i data-lucide="check" style="width:14px; color:var(--ok);"></i>
                `;
                summaryList.appendChild(item);
                refreshIcons();
            }

            cont.style.display = 'none';
            // Update progress circle
            const total = 9;
            const count = Object.keys(tempM).length;
            const perc = Math.round((count / total) * 100);
            const percEl = document.getElementById('profile-perc');
            const barEl = document.getElementById('profile-progress-bar');
            if (percEl) percEl.innerText = `${perc}%`;
            if (barEl) barEl.style.width = `${perc}%`;
        };
    });

    const finalize = async () => {
        try {
            console.log('Finalizzazione aggiunta moto. Moto attuali:', appState.bikes.length);
            // Se non stiamo aggiungendo una nuova moto, aggiorna anche il nome utente
            if (!isAddingNewBike) {
                appState.user.name = document.getElementById('user-name').value || 'Pilota';
                const emailInp = document.getElementById('user-email');
                if (emailInp && !IS_NATIVE) appState.user.email = emailInp.value.trim();
            }
            const nBike = {
                id: Date.now().toString(),
                model: document.getElementById('moto-model').value || 'Moto',
                currentKm: parseInt(document.getElementById('current-km-total').value) || 0,
                maintenance: { ...tempM },
                logs: [],
                costs: [],
                documents: {}
            };
            if (tempBImage) {
                console.log('Salvataggio immagine moto...');
                nBike.photo = await ImageManager.saveImage(tempBImage, 'bike');
            }
            appState.bikes.push(nBike);
            appState.selectedBikeId = nBike.id;

            console.log('Salvataggio stato con', appState.bikes.length, 'moto.');
            await saveState();
            if (!IS_NATIVE) await syncWithWorker();

            elements.onboardingOverlay?.classList.add('hidden');
            isAddingNewBike = false;
            boot(true);
        } catch (err) {
            console.error('Errore in finalize:', err);
            alert('Errore durante il salvataggio: ' + err.message);
        }
    };

    document.getElementById('start-onboarding').onclick = () => {
        isAddingNewBike = false;
        // Ripristina i punti di avanzamento e torna allo step 1
        const stepsContainer = document.querySelector('.onboarding-steps');
        if (stepsContainer) stepsContainer.style.display = '';
        nextS(1);
        elements.onboardingOverlay?.classList.remove('hidden');
    };

    // --- Tasto "Aggiungi" nel Garage (quando ci sono già moto) ---
    const addBikeGarageBtn = document.getElementById('add-bike-garage');
    if (addBikeGarageBtn) {
        addBikeGarageBtn.onclick = () => {
            isAddingNewBike = true;
            resetBikeOnboarding();
            // Nascondi lo step 1 (profilo), mostra direttamente step 2 (moto)
            nextS(2);
            // Nascondi i punti di avanzamento (non rilevanti per aggiunta moto)
            const stepsContainer = document.querySelector('.onboarding-steps');
            if (stepsContainer) stepsContainer.style.display = 'none';
            elements.onboardingOverlay?.classList.remove('hidden');
        };
    }
    document.getElementById('save-quick-bike').onclick = finalize;
    document.getElementById('save-profile').onclick = finalize;
    document.getElementById('skip-maint-save').onclick = finalize;
    const cancelBtn = document.getElementById('cancel-onboarding');
    if (cancelBtn) cancelBtn.onclick = () => {
        elements.onboardingOverlay?.classList.add('hidden');
        isAddingNewBike = false;
    };
    document.querySelectorAll('.btn-next').forEach(b => b.onclick = () => nextS(b.dataset.next));

    const up = document.getElementById('user-photo');
    if (up) up.onchange = (e) => {
        const rd = new FileReader();
        rd.onload = (v) => { appState.user.photo = v.target.result; document.getElementById('profile-img-preview').innerHTML = `<img src="${v.target.result}" style="width:100%; height:100%; object-fit:cover;">`; };
        rd.readAsDataURL(e.target.files[0]);
    };
    const mp = document.getElementById('moto-photo');
    if (mp) mp.onchange = (e) => {
        const rd = new FileReader();
        rd.onload = (v) => { tempBImage = v.target.result; document.getElementById('moto-img-preview').innerHTML = `<img src="${v.target.result}" style="width:100%; height:100%; object-fit:cover;">`; };
        rd.readAsDataURL(e.target.files[0]);
    };

    // --- Global Init (Boot) ---
    async function boot(skipLoad = false) {
        if (!skipLoad) await loadState();
        updateSidebarInfo();
        if (appState.bikes.length === 0) {
            elements.onboardingOverlay?.classList.remove('hidden');
            switchScreen('dashboard');
        } else {
            elements.onboardingOverlay?.classList.add('hidden');
            switchScreen('dashboard');
        }
        if (!IS_NATIVE) await syncWithWorker();
        refreshIcons();
    }

    await boot();
    window.nextStepGlobal = nextS; // For external calls
});
