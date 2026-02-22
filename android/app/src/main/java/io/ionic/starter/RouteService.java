package io.ionic.starter;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class RouteService extends Service implements LocationListener {
    private static final String CHANNEL_ID = "route_tracking_channel";
    private static final int NOTIFICATION_ID = 101;
    
    // Dati statici per accesso da MainActivity
    public static double totalDistance = 0;
    public static List<JSONObject> backgroundPoints = new ArrayList<>();
    public static boolean isRunning = false;

    private LocationManager locationManager;
    private Location lastLocation = null;

    @Override
    public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if ("START_TRACKING".equals(action)) {
            resetData();
            startForegroundService();
            startLocationUpdates();
            isRunning = true;
        } else if ("STOP_TRACKING".equals(action) || action == null) {
            stopLocationUpdates();
            stopForeground(true);
            stopSelf();
            isRunning = false;
        }
        return START_STICKY;
    }

    private void resetData() {
        totalDistance = 0;
        backgroundPoints.clear();
        lastLocation = null;
    }

    private void startLocationUpdates() {
        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER, 
                2000, // 2 secondi
                2,    // 2 metri
                this
            );
        } catch (SecurityException e) {
            e.printStackTrace();
        }
    }

    private void stopLocationUpdates() {
        locationManager.removeUpdates(this);
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) return;

        if (lastLocation != null) {
            double d = getDistance(lastLocation.getLatitude(), lastLocation.getLongitude(),
                                  location.getLatitude(), location.getLongitude());
            
            // Filtro piccoli salti (meno di 200m tra update)
            if (d < 0.2) {
                totalDistance += d;
            }
        }
        lastLocation = location;

        // Salva punto per sincronizzazione JS
        try {
            JSONObject pt = new JSONObject();
            pt.put("lat", location.getLatitude());
            pt.put("lng", location.getLongitude());
            pt.put("alt", location.getAltitude());
            pt.put("speed", location.getSpeed() * 3.6);
            pt.put("time", System.currentTimeMillis());
            backgroundPoints.add(pt);
        } catch (Exception e) {
            e.printStackTrace();
        }

        updateNotification();
    }

    private void updateNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification());
        }
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, 
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        String distStr = String.format("%.2f km", totalDistance);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Biker Manager - Registrazione")
                .setContentText("Distanza: " + distStr)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void startForegroundService() {
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Route Tracking Service Channel",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    private double getDistance(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}
    @Override public IBinder onBind(Intent intent) { return null; }
}
