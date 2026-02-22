const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, 'assets', 'logo.jpg');
const dest = path.join(__dirname, 'assets', 'icon-only.png');

sharp(src)
  .resize(1024, 1024)
  .toFile(dest)
  .then(() => console.log('Successfully converted icon to PNG'))
  .catch(err => {
    console.error('Error converting icon:', err);
    process.exit(1);
  });
