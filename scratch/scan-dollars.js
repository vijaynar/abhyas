const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../apps/web/src');

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('DollarSign')) {
        console.log(`FOUND DollarSign: ${fullPath}`);
      }
    }
  }
}

console.log(`Scanning: ${srcDir}`);
scanDir(srcDir);
