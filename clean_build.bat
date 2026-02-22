@echo off
echo [App Moto] Pulizia e Build in corso...

:: Cerca di disinstallare le versioni note per evitare conflitti
echo [1/3] Disinstallazione versioni precedenti...
adb uninstall io.ionic.starter >nul 2>&1
adb uninstall com.biker.manager >nul 2>&1

:: Esegue il build degli asset web
echo [2/3] Build asset web...
call node build.js

:: Sincronizza ed esegue su dispositivo
echo [3/3] Deploy su Samsung...
powershell -ExecutionPolicy Bypass -Command "npx cap sync && npx cap run android --target R58N4229C9J"

echo [DONE] L'app e stata reinstallata da zero!
