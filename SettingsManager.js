import ImageManager from './ImageManager.js';

/**
 * SettingsManager.js
 * Handles user settings, onboarding, and notification configuration.
 */
const SettingsManager = {
    /**
     * Render the settings screen content.
     */
    renderSettings(container, appState, callbacks) {
        if (!container) return;

        // Implementation of rendering settings cards, notification toggles, etc.
        // This will be invoked by app.js when switching to 'settings'.
        container.innerHTML = `
            <div class="header-card">
                <h2>Profilo e Impostazioni</h2>
                <p>Gestisci il tuo profilo e le preferenze dell'app.</p>
            </div>
            
            <div class="settings-section" style="margin-top:20px;">
                <div class="settings-card" style="background:#222; border-radius:16px; padding:20px; border:1px solid #333;">
                    <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
                        <div id="st-profile-preview" style="width:60px; height:60px; background:#333; border-radius:50%; overflow:hidden;">
                            <i data-lucide="user" style="width:100%; height:100%; padding:15px; color:#666;"></i>
                        </div>
                        <div>
                            <h3 style="margin:0;">${appState.user.name || 'Pilota'}</h3>
                            <label for="st-user-photo" style="font-size:12px; color:var(--primary); cursor:pointer;">Cambia Foto</label>
                            <input type="file" id="st-user-photo" accept="image/*" style="display:none;">
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Nome Visualizzato</label>
                        <input type="text" id="st-user-name" value="${appState.user.name || ''}" placeholder="Tuo nome">
                    </div>
                    ${!Capacitor.isNativePlatform() ? `
                    <div class="input-group" style="margin-top:15px;">
                        <label>Email per Notifiche</label>
                        <input type="email" id="st-user-email" value="${appState.user.email || ''}" placeholder="Tua email">
                    </div>
                    ` : ''}
                </div>

                <div class="settings-card" style="background:#222; border-radius:16px; padding:20px; border:1px solid #333; margin-top:15px;">
                    <h4 style="margin-top:0;">Notifiche</h4>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span>Attiva Avvisi</span>
                        <input type="checkbox" id="st-notif-enabled" ${appState.notificationSettings.enabled ? 'checked' : ''}>
                    </div>
                    <div class="input-group" style="margin-top:15px;">
                        <label>Anticipo Avviso (Giorni)</label>
                        <input type="number" id="st-notif-days" value="${appState.notificationSettings.advanceDays || 7}">
                    </div>
                </div>

                <div style="text-align: center; margin-top: 32px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
                    <button id="st-save" class="btn btn-primary">Salva Impostazioni</button>
                    <div style="width: 100%; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 32px;">
                        <button id="reset-app" class="btn btn-danger">Svuota Tutti i Dati (Reset)</button>
                    </div>
                </div>
            </div>
        `;

        // Async load profile photo
        if (appState.user.photo) {
            ImageManager.getImageSrc(appState.user.photo).then(src => {
                const prev = document.getElementById('st-profile-preview');
                if (prev) prev.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:cover;">`;
            });
        }

        // Bind events
        document.getElementById('st-save').onclick = () => callbacks.onSave();
        document.getElementById('reset-app').onclick = () => callbacks.onReset();

        const photoInput = document.getElementById('st-user-photo');
        if (photoInput) {
            photoInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) callbacks.onPhotoChange(file);
            };
        }
    }
};

export default SettingsManager;
