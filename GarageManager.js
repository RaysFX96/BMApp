import ImageManager from './ImageManager.js';

/**
 * GarageManager.js
 * Handles bike-related logic (Garage rendering, Edit Bike, etc.)
 */
const GarageManager = {
    /**
     * Calculate profile completion percentage.
     * @param {Object} bike 
     * @returns {number}
     */
    calculateProfileCompletion(bike) {
        if (!bike || !bike.maintenance) return 0;
        const total = 9; // Number of maintenance categories
        const count = Object.keys(bike.maintenance).length;
        return Math.round((count / total) * 100);
    },

    /**
     * Render the garage list.
     * @param {HTMLElement} container - The list container.
     * @param {Array} bikes - The list of bikes from appState.
     * @param {Function} onSelect - Callback when a bike is clicked.
     * @param {Function} onEdit - Callback when the edit button is clicked.
     */
    async renderGarage(container, bikes, onSelect, onEdit) {
        if (!container) return;
        container.innerHTML = '';

        for (const bike of bikes) {
            const card = document.createElement('div');
            card.className = 'bike-card';

            const completion = this.calculateProfileCompletion(bike);
            const status = this.getBikeStatus(bike);
            const imgSrc = await ImageManager.getImageSrc(bike.photo);

            card.innerHTML = `
                <div class="bike-card-img">
                    ${imgSrc ? `<img src="${imgSrc}">` : `<i data-lucide="bike" style="width: 100%; height: 100%; padding: 20px; color: #ccc;"></i>`}
                </div>
                <div class="bike-card-info">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <h4>${bike.model}</h4>
                        <span class="status-indicator ${status.class}">${status.text}</span>
                    </div>
                    <p>${bike.currentKm.toLocaleString()} km totali</p>
                    <div style="margin: 8px 0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
                            <div style="font-size: 10px; color: #888;">Completamento Profilo: ${completion}%</div>
                            <button class="btn-edit-bike-card" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; cursor:pointer; padding:6px; border-radius:10px; display:flex; align-items:center; justify-content:center;">
                                <i data-lucide="settings" style="width:18px; height:18px;"></i>
                            </button>
                        </div>
                        <div style="height: 4px; background: #333; border-radius: 2px; overflow: hidden;">
                            <div style="width: ${completion}%; height: 100%; background: ${completion >= 100 ? '#4caf50' : 'var(--primary)'}"></div>
                        </div>
                    </div>
                </div>
                <div class="bike-card-action">
                    <i data-lucide="chevron-right"></i>
                </div>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-edit-bike-card')) return;
                onSelect(bike);
            });

            card.querySelector('.btn-edit-bike-card').addEventListener('click', (e) => {
                e.stopPropagation();
                onEdit(bike);
            });

            container.appendChild(card);
        }
        if (window.refreshIcons) window.refreshIcons();
    },

    /**
     * Show the edit bike modal.
     */
    editBike(bike, openModal, callbacks) {
        const body = `
            <div style="text-align: center; margin-bottom: 24px;">
                <div id="ed-bike-preview" class="img-preview" style="width: 100%; height: 140px; background: rgba(255,255,255,0.03); border-radius: 16px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                    <i data-lucide="bike" style="width: 48px; height: 48px; color: #666;"></i>
                </div>
                <label for="ed-bike-photo" class="btn btn-text" style="font-size: 14px; cursor: pointer; color: var(--primary);">Cambia Foto Moto</label>
                <input type="file" id="ed-bike-photo" accept="image/*" style="display: none;">
            </div>

            <div class="input-group" style="margin-bottom: 16px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Modello</label>
                <input type="text" id="ed-model" value="${bike.model}">
            </div>
            
            <div class="input-group" style="margin-bottom: 24px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Km Attuali</label>
                <input type="number" id="ed-current-km" value="${bike.currentKm}">
            </div>
            
            <div class="input-group" style="margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 24px;">
                <label>Gestione Manutenzioni</label>
                <select id="ed-maint-selector">
                    <option value="" disabled selected>Seleziona per modificare...</option>
                    <option value="assicurazione">Assicurazione</option>
                    <option value="bollo">Bollo</option>
                    <option value="revisione">Revisione</option>
                    <option value="tagliando">Tagliando</option>
                    <option value="gomme">Gomme</option>
                    <option value="freni">Freni</option>
                    <option value="refrigerante">Refrigerante</option>
                    <option value="liquido_freni">Liquido Freni</option>
                    <option value="trasmissione">Trasmissione</option>
                    <option value="carburante">Carburante</option>
                    <option value="altro">Altro</option>
                </select>
                <div id="ed-maint-inputs" style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; display: none; border: 1px solid rgba(255,255,255,0.1);"></div>
            </div>

            <div style="margin-top: 48px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 32px; text-align: center;">
                <button id="ed-delete-bike" class="btn btn-danger">Elimina Moto dal Garage</button>
            </div>
        `;

        openModal(`Modifica ${bike.model}`, body, async () => {
            bike.model = document.getElementById('ed-model').value;
            bike.currentKm = parseInt(document.getElementById('ed-current-km').value) || 0;
            await callbacks.onSave();
        });

        // Load preview
        ImageManager.getImageSrc(bike.photo).then(src => {
            const prev = document.getElementById('ed-bike-preview');
            if (prev && src) prev.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:cover;">`;
        });

        // Photo handler
        const photoInput = document.getElementById('ed-bike-photo');
        if (photoInput) {
            photoInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) callbacks.onPhotoChange(file);
            };
        }

        // Delete handler
        const delBtn = document.getElementById('ed-delete-bike');
        if (delBtn) delBtn.onclick = () => callbacks.onDelete();

        // Maint selector logic
        const sel = document.getElementById('ed-maint-selector');
        const cont = document.getElementById('ed-maint-inputs');
        sel?.addEventListener('change', () => {
            const cat = sel.value;
            cont.style.display = 'block';
            if (!bike.maintenance) bike.maintenance = {};
            const cur = bike.maintenance[cat] || {};
            const needsKm = !['assicurazione', 'bollo', 'revisione'].includes(cat);

            let h = `<div style="margin-bottom: 12px;"><label style="display: block; font-size: 12px; color: #888; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Data</label><input type="date" id="edm-date" value="${cur.lastDate || ''}" style="width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-size: 15px;"></div>`;
            if (needsKm) {
                h += `<div style="margin-bottom: 12px;"><label style="display: block; font-size: 12px; color: #888; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Km</label><input type="number" id="edm-km" value="${cur.lastKm || 0}" style="width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-size: 15px;"></div>`;
                h += `<div style="margin-bottom: 12px;"><label style="display: block; font-size: 12px; color: #888; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Int. KM</label><input type="number" id="edm-int-km" value="${cur.intervalKm || 1000}" style="width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-size: 15px;"></div>`;
                h += `<div style="margin-bottom: 12px;"><label style="display: block; font-size: 12px; color: #888; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Int. Mesi</label><input type="number" id="edm-int-months" value="${cur.intervalMonths || 12}" style="width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-size: 15px;"></div>`;
            }
            if (cat === 'assicurazione') {
                h += `<div style="margin-bottom: 12px;"><label style="display: block; font-size: 12px; color: #888; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Tipo</label><select id="edm-type" style="width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-size: 14px; cursor: pointer;">
                     <option value="annuale" ${cur.type === 'annuale' ? 'selected' : ''}>Annuale</option>
                     <option value="semestrale" ${cur.type === 'semestrale' ? 'selected' : ''}>Semestrale</option>
                     <option value="trimestrale" ${cur.type === 'trimestrale' ? 'selected' : ''}>Trimestrale</option>
                 </select></div>`;
            }
            h += `<button id="edm-save" class="btn btn-primary" style="width:100%; padding: 14px; font-size:14px; font-weight: 600; border-radius: 12px; margin-top: 8px;">Aggiorna ${cat}</button>`;
            cont.innerHTML = h;

            document.getElementById('edm-save').addEventListener('click', () => {
                const data = { lastDate: document.getElementById('edm-date').value };
                if (needsKm) {
                    data.lastKm = parseInt(document.getElementById('edm-km').value) || 0;
                    data.intervalKm = parseInt(document.getElementById('edm-int-km').value) || 0;
                    data.intervalMonths = parseInt(document.getElementById('edm-int-months').value) || 0;
                    // Calculate intervalDays from intervalMonths (30 days per month average)
                    data.intervalDays = data.intervalMonths * 30;
                } else {
                    // For date-only maintenance (assicurazione, bollo, revisione), use standard intervals
                    if (cat === 'assicurazione' || cat === 'bollo') {
                        data.intervalDays = 365;
                    } else if (cat === 'revisione') {
                        data.intervalDays = 730; // 2 years
                    }
                }
                if (cat === 'assicurazione') data.type = document.getElementById('edm-type').value;

                bike.maintenance[cat] = data;
                cont.style.display = 'none';
                sel.value = "";
                alert(`Dati ${cat} aggiornati.`);
            });
        });
    },

    /**
     * Get bike health status.
     * Checks all maintenance categories for expiration (time or km).
     */
    getBikeStatus(bike) {
        if (!bike || !bike.maintenance) return { class: 'status-ok', text: 'In Forma' };

        let status = { class: 'status-ok', text: 'In Forma' };
        let isCritical = false;
        let isWarning = false;

        Object.entries(bike.maintenance).forEach(([key, m]) => {
            if (!m.lastDate) return;

            // 1. Time Check
            const lastDate = new Date(m.lastDate);
            const intervalMonths = m.intervalMonths || 12;
            const nextDate = new Date(lastDate);
            nextDate.setMonth(nextDate.getMonth() + intervalMonths);

            const daysRemaining = Math.ceil((nextDate - new Date()) / 86400000);

            if (daysRemaining < 0) {
                isCritical = true;
            } else if (daysRemaining <= 15) {
                isWarning = true;
            }

            // 2. KM Check
            if (m.intervalKm > 0) {
                const kmSince = bike.currentKm - (m.lastKm || 0);
                const kmRemaining = m.intervalKm - kmSince;

                if (kmRemaining < 0) {
                    isCritical = true;
                } else if (kmRemaining < 1000) {
                    isWarning = true;
                }
            }
        });

        if (isCritical) {
            status = { class: 'status-critical', text: 'Scaduto' };
        } else if (isWarning) {
            status = { class: 'status-alert', text: 'Attenzione' };
        }

        return status;
    }
};

export default GarageManager;
