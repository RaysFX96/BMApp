const fs = require('fs');
const path = require('path');

require('esbuild').build({
    entryPoints: ['app.js'],
    bundle: true,
    outfile: 'docs/app.js',
}).then(() => {
    // Copy Leaflet CSS
    const cssSrc = path.join(__dirname, 'node_modules/leaflet/dist/leaflet.css');
    const cssDest = path.join(__dirname, 'docs/leaflet.css');
    fs.copyFileSync(cssSrc, cssDest);

    // Copy index.html, styles.css, manifest.json, service-worker.js
    fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(__dirname, 'docs/index.html'));
    fs.copyFileSync(path.join(__dirname, 'styles.css'), path.join(__dirname, 'docs/styles.css'));
    fs.copyFileSync(path.join(__dirname, 'motor-theme.css'), path.join(__dirname, 'docs/motor-theme.css'));
    if (fs.existsSync(path.join(__dirname, 'manifest.json'))) {
        fs.copyFileSync(path.join(__dirname, 'manifest.json'), path.join(__dirname, 'docs/manifest.json'));
    }
    if (fs.existsSync(path.join(__dirname, 'service-worker.js'))) {
        fs.copyFileSync(path.join(__dirname, 'service-worker.js'), path.join(__dirname, 'docs/service-worker.js'));
    }

    // Copy Assets folder
    const assetsSrc = path.join(__dirname, 'assets');
    const assetsDest = path.join(__dirname, 'docs/assets');
    if (fs.existsSync(assetsSrc)) {
        if (!fs.existsSync(assetsDest)) fs.mkdirSync(assetsDest, { recursive: true });
        fs.readdirSync(assetsSrc).forEach(file => {
            fs.copyFileSync(path.join(assetsSrc, file), path.join(assetsDest, file));
        });
    }

    console.log('Build complete and assets copied.');
}).catch(() => process.exit(1))
