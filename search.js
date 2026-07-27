const fs = require('fs');
const path = require('path');

function search(dir, regex) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      search(fullPath, regex);
    } else if (stat.isFile() && fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (regex.test(content)) {
        console.log(`Found in: ${fullPath}`);
        const match = content.match(new RegExp(`.{0,50}${regex.source}.{0,50}`, 'g'));
        if (match) {
          console.log(match);
        }
      }
    }
  }
}

search('.next/server', /<Html> should not be imported/);
