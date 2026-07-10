const fs = require('fs');
const lines = fs.readFileSync('server/ai/respondStream.ts', 'utf8').split('\n');
const fixed = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('});') && i == 300) continue;
  if (lines[i].includes('      }') && i == 301) continue;
  if (lines[i].includes('    }') && i == 302) continue;
  fixed.push(lines[i]);
}
fs.writeFileSync('server/ai/respondStream.ts', fixed.join('\n'));
