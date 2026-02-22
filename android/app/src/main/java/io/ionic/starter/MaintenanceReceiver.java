package io.ionic.starter;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class MaintenanceReceiver extends BroadcastReceiver {
    
    private static final String PREFS_NAME = "BikerManagerPrefs";
    private static final String KEY_APP_STATE = "moto_app_v2";
    private static final String CHANNEL_ID = "maintenance_channel";
    private static final int ADVANCE_DAYS = 7;
    
    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String appStateJson = prefs.getString(KEY_APP_STATE, "");
            
            if (appStateJson.isEmpty()) {
                return;
            }
            
            JSONObject appState = new JSONObject(appStateJson);
            JSONArray bikes = appState.optJSONArray("bikes");
            
            if (bikes == null || bikes.length() == 0) {
                return;
            }
            
            createNotificationChannel(context);
            
            for (int i = 0; i < bikes.length(); i++) {
                JSONObject bike = bikes.getJSONObject(i);
                String bikeName = bike.optString("name", "Moto");
                JSONObject maintenance = bike.optJSONObject("maintenance");
                
                if (maintenance == null) continue;
                
                checkMaintenance(context, bikeName, maintenance, "tagliando", "Tagliando");
                checkMaintenance(context, bikeName, maintenance, "gomme", "Gomme");
                checkMaintenance(context, bikeName, maintenance, "trasmissione", "Trasmissione");
                checkMaintenance(context, bikeName, maintenance, "liquido_freni", "Liquido Freni");
                checkDateMaintenance(context, bikeName, maintenance, "revisione", "Revisione");
                checkDateMaintenance(context, bikeName, maintenance, "assicurazione", "Assicurazione");
                checkDateMaintenance(context, bikeName, maintenance, "bollo", "Bollo");
            }
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    private void checkMaintenance(Context context, String bikeName, JSONObject maintenance, 
                                  String key, String label) {
        try {
            JSONObject item = maintenance.optJSONObject(key);
            if (item == null) return;
            
            int lastKm = item.optInt("lastKm", 0);
            int intervalKm = item.optInt("intervalKm", 0);
            
            if (intervalKm > 0) {
                int remaining = intervalKm - lastKm;
                if (remaining <= 500 && remaining > 0) {
                    String message = label + " tra " + remaining + " km";
                    sendNotification(context, bikeName, message);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    private void checkDateMaintenance(Context context, String bikeName, JSONObject maintenance,
                                     String key, String label) {
        try {
            JSONObject item = maintenance.optJSONObject(key);
            if (item == null) return;
            
            String lastDate = item.optString("lastDate", "");
            if (lastDate.isEmpty()) return;
            
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
            Date date = sdf.parse(lastDate);
            if (date == null) return;
            
            Calendar cal = Calendar.getInstance();
            cal.setTime(date);
            
            if (key.equals("revisione")) {
                cal.add(Calendar.YEAR, 2);
            } else if (key.equals("assicurazione") || key.equals("bollo")) {
                cal.add(Calendar.YEAR, 1);
            } else {
                int intervalMonths = item.optInt("intervalMonths", 12);
                cal.add(Calendar.MONTH, intervalMonths);
            }
            
            Date expiryDate = cal.getTime();
            Calendar today = Calendar.getInstance();
            Calendar advanceCal = Calendar.getInstance();
            advanceCal.setTime(expiryDate);
            advanceCal.add(Calendar.DAY_OF_YEAR, -ADVANCE_DAYS);
            
            if (today.after(advanceCal) && today.before(cal)) {
                long diff = expiryDate.getTime() - today.getTimeInMillis();
                int daysRemaining = (int) (diff / (1000 * 60 * 60 * 24));
                String message = label + " tra " + daysRemaining + " giorni";
                sendNotification(context, bikeName, message);
            }
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Manutenzioni",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifiche per scadenze manutenzioni");
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }
    
    private void sendNotification(Context context, String title, String message) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 
            0, 
            intent, 
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);
        
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        manager.notify((int) System.currentTimeMillis(), builder.build());
    }
}
