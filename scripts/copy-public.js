const fs = require('fs');
const files = ['landing', 'partner', 'admin', 'portal'];
files.forEach(f => fs.copyFileSync(`public/${f}.html`, `dist/${f}.html`));
fs.copyFileSync('public/apple-touch-icon.png', 'dist/apple-touch-icon.png');
fs.copyFileSync('public/sw.js', 'dist/sw.js');
