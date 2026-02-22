@echo off
echo [App Moto] Aggiornamento Sicuro in corso...

:: Build asset web
echo [1/2] Build asset web...
call node build.js

:: Sincronizza ed esegue su dispositivo (AGGIORNAMENTO, non reinstallazione)
:: NON USARE MAI PIU ADB UNINSTALL
echo [2/2] Aggiornamento su Samsung (Target: R58N4229C9J)...
powershell -ExecutionPolicy Bypass -Command "npx cap sync; npx cap run android --target R58N4229C9J"

echo [DONE] L'app e stata ripristinata con tutte le funzioni e i tuoi dati sono salvi!
