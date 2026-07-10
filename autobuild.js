import { execSync } from 'child_process';
import fs from 'fs';

let retries = 50;
while (retries > 0) {
  try {
    execSync('npm run build', { stdio: 'pipe' });
    console.log("Build SUCCESS");
    break;
  } catch (err) {
    const out = err.stdout.toString() + err.stderr.toString();
    const match = out.match(/src\/components\/views\/PaperStructureView\.tsx:(\d+):(\d+): ERROR: Expected "\)"/);
    if (!match) {
        console.log("Other error");
        console.log(out.substring(0, 1000));
        break;
    }
    const line = parseInt(match[1]);
    console.log("Fixing line", line);
    let p = fs.readFileSync('src/components/views/PaperStructureView.tsx', 'utf8');
    let lines = p.split('\n');
    let brokenLine = lines[line - 1];
    
    let fixed = false;
    for (let i = line - 1; i >= line - 6; i--) {
        if (lines[i] && lines[i].trim() === '}') {
            lines[i] = lines[i].replace('}', '});');
            fixed = true;
            break;
        }
    }
    if (fixed) {
        fs.writeFileSync('src/components/views/PaperStructureView.tsx', lines.join('\n'));
        console.log("Applied auto-fix.");
    } else {
        console.log("Could not auto-fix. Context:");
        console.log(lines.slice(line-4, line+1).join('\n'));
        break;
    }
    retries--;
  }
}
