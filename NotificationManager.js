import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * NotificationManager.js
 * Handles scheduling of maintenance alerts via Capacitor Local Notifications.
 */
const NotificationManager = {
    /**
     * Request permissions for local notifications.
     */
    async requestPermission() {
        try {
            const perm = await LocalNotifications.requestPermissions();
            console.log('Notification permission status:', perm.display);
            return perm.display === 'granted';
        } catch (e) {
            console.error('Error requesting notification permissions:', e);
            return false;
        }
    },

    /**
     * Clear all pending notifications and reschedule based on appState.
     * @param {Object} appState 
     */
    async syncNotifications(appState) {
        if (!appState.notificationSettings?.enabled) {
            await LocalNotifications.cancel({ notifications: await this.getPendingIds() });
            console.log('Notifications disabled, all pending cleared.');
            return;
        }

        try {
            // 1. Clear previous
            const pending = await LocalNotifications.getPending();
            if (pending.notifications.length > 0) {
                await LocalNotifications.cancel({ notifications: pending.notifications });
            }

            const advanceDays = parseInt(appState.notificationSettings.advanceDays) || 7;
            const newNotifications = [];
            let idCounter = 1;

            appState.bikes.forEach(bike => {
                if (!bike.maintenance) return;

                Object.entries(bike.maintenance).forEach(([cat, m]) => {
                    if (!m.lastDate) return;

                    const lastDate = new Date(m.lastDate);
                    const intervalMonths = m.intervalMonths || (cat === 'revisione' ? 24 : 12);

                    const nextDate = new Date(lastDate);
                    nextDate.setMonth(nextDate.getMonth() + intervalMonths);

                    const triggerDate = new Date(nextDate);
                    triggerDate.setDate(triggerDate.getDate() - advanceDays);

                    // Specific hour for notification (e.g., 09:00 AM)
                    triggerDate.setHours(9, 0, 0, 0);

                    const now = new Date();

                    let title = '';
                    let body = '';
                    let scheduleAt = null;

                    if (nextDate < now) {
                        // Already expired - notify immediately (in 5 seconds)
                        title = `Scadenza Superata: ${cat.toUpperCase()}`;
                        body = `La manutenzione "${cat}" per ${bike.model} è scaduta il ${nextDate.toLocaleDateString()}.`;
                        scheduleAt = new Date(Date.now() + 5000);
                    } else if (now >= triggerDate) {
                        // Within warning window - notify immediately
                        title = `Scadenza Imminente: ${cat.toUpperCase()}`;
                        const daysLeft = Math.ceil((nextDate - now) / 86400000);
                        body = `Mancano ${daysLeft} giorni alla scadenza di "${cat}" per ${bike.model}.`;
                        scheduleAt = new Date(Date.now() + 10000);
                    } else {
                        // Future warning
                        title = `Promemoria: ${cat.toUpperCase()}`;
                        body = `Tra ${advanceDays} giorni scadrà "${cat}" per ${bike.model}.`;
                        scheduleAt = triggerDate;
                    }

                    if (scheduleAt) {
                        newNotifications.push({
                            title: title,
                            body: body,
                            id: idCounter++,
                            schedule: { at: scheduleAt },
                            sound: 'default',
                            attachments: null,
                            actionTypeId: '',
                            extra: { cat, bikeId: bike.id }
                        });
                    }
                });
            });

            if (newNotifications.length > 0) {
                await LocalNotifications.schedule({
                    notifications: newNotifications
                });
                console.log(`Scheduled ${newNotifications.length} maintenance notifications.`);
            }

        } catch (e) {
            console.error('Error syncing notifications:', e);
        }
    },

    async getPendingIds() {
        const pending = await LocalNotifications.getPending();
        return pending.notifications.map(n => ({ id: n.id }));
    }
};

export default NotificationManager;
