const fs = require('fs');
const files = ['landing', 'partner', 'admin', 'portal'];
files.forEach(f => fs.copyFileSync(`public/${f}.html`, `dist/${f}.html`));
