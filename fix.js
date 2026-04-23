const fs = require('fs');
const path = require('path');

const walkDir = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('layout/') || content.includes('header/') || content.includes('sidebar/')) {
         content = content.replace(/layout\//g, 'Layout/')
                          .replace(/header\//g, 'Header/')
                          .replace(/sidebar\//g, 'Sidebar/');
         fs.writeFileSync(fullPath, content);
      }
    }
  }
};
walkDir('frontend/src');
