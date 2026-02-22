const fs = require('fs');
const path = require('path');

const plugins = [
    { name: 'geolocation', pkg: '@capacitor/geolocation' },
    { name: 'motion', pkg: '@capacitor/motion' }
];

const targetDir = path.join(__dirname, 'www/js/plugins');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

plugins.forEach(p => {
    // Try to find the EMS entry point or main dist file
    const pkgPath = path.join(__dirname, 'node_modules', p.pkg, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        // Prefer module (ESM) over main (CJS)
        const distFile = pkg.module || pkg.main || 'dist/index.js';
        const srcPath = path.join(__dirname, 'node_modules', p.pkg, distFile);
        const destPath = path.join(targetDir, `${p.name}.js`);

        console.log(`Copying ${p.pkg} from ${srcPath} to ${destPath}`);

        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
        } else {
            console.error(`Could not find source file for ${p.pkg}`);
        }
    } else {
        console.error(`Could not find package.json for ${p.pkg}`);
    }
});

console.log('Plugins copied successfully.');
