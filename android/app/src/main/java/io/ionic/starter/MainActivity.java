package io.ionic.starter;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Request battery optimization exemption
        BatteryOptimizationHelper.requestIgnoreBatteryOptimizations(this);
        
        // Schedule maintenance alarm
        BootReceiver.scheduleMaintenanceAlarm(this);
        
        // Add JS Interface for exiting app and syncing data
        this.bridge.getWebView().addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void exitApp() {
                finish();
            }
            
            @android.webkit.JavascriptInterface
            public void syncDataToNative(String jsonData) {
                android.content.SharedPreferences prefs = getSharedPreferences("BikerManagerPrefs", MODE_PRIVATE);
                prefs.edit().putString("moto_app_v2", jsonData).apply();
            }

            @android.webkit.JavascriptInterface
            public String getDataFromNative() {
                android.content.SharedPreferences prefs = getSharedPreferences("BikerManagerPrefs", MODE_PRIVATE);
                return prefs.getString("moto_app_v2", null);
            }
            @android.webkit.JavascriptInterface
            public void toggleRouteService(boolean start) {
                android.content.Intent intent = new android.content.Intent(MainActivity.this, RouteService.class);
                if (start) {
                    intent.setAction("START_TRACKING");
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        startForegroundService(intent);
                    } else {
                        startService(intent);
                    }
                } else {
                    intent.setAction("STOP_TRACKING");
                    startService(intent);
                }
            }
            @android.webkit.JavascriptInterface
            public String getBackgroundData() {
                try {
                    org.json.JSONObject data = new org.json.JSONObject();
                    data.put("totalDist", RouteService.totalDistance);
                    
                    org.json.JSONArray points = new org.json.JSONArray();
                    for (org.json.JSONObject pt : RouteService.backgroundPoints) {
                        points.put(pt);
                    }
                    data.put("points", points);
                    return data.toString();
                } catch (Exception e) {
                    return "{}";
                }
            }
        }, "AndroidFunction");
    }

    @Override
    public void onBackPressed() {
        // Dispatch custom event to JS
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('customBackButton'))", null);
        } else {
            super.onBackPressed();
        }
    }
}
