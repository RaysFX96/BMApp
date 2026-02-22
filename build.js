const fs = require('fs');
const path = require('path');

require('esbuild').build({
    entryPoints: ['app.js'],
    bundle: true,
    outfile: 'www/app.js',
}).then(() => {
    // Copy Leaflet CSS
    const cssSrc = path.join(__dirname, 'node_modules/leaflet/dist/leaflet.css');
    const cssDest = path.join(__dirname, 'www/leaflet.css');
    fs.copyFileSync(cssSrc, cssDest);

    // Copy index.html and styles.css
    fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(__dirname, 'www/index.html'));
    fs.copyFileSync(path.join(__dirname, 'styles.css'), path.join(__dirname, 'www/styles.css'));
    fs.copyFileSync(path.join(__dirname, 'motor-theme.css'), path.join(__dirname, 'www/motor-theme.css'));

    // Copy Assets folder
    const assetsSrc = path.join(__dirname, 'assets');
    const assetsDest = path.join(__dirname, 'www/assets');
    if (fs.existsSync(assetsSrc)) {
        if (!fs.existsSync(assetsDest)) fs.mkdirSync(assetsDest, { recursive: true });
        fs.readdirSync(assetsSrc).forEach(file => {
            fs.copyFileSync(path.join(assetsSrc, file), path.join(assetsDest, file));
        });
    }

    console.log('Build complete and assets copied.');
}).catch(() => process.exit(1))
