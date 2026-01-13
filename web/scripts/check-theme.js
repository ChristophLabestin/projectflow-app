import { promises as fs } from 'node:fs';
import path from 'node:path';

const roots = ['screens', 'components'];
const extensions = new Set(['.ts', '.tsx', '.scss', '.css']);
const pattern = /bg-\[var\(--color-primary\)\][^\n]*\btext-white\b/;

const violations = [];

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }

    if (!extensions.has(path.extname(entry.name))) continue;

    const contents = await fs.readFile(fullPath, 'utf8');
    const lines = contents.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        violations.push({
          file: fullPath,
          line: index + 1,
          text: line.trim(),
        });
      }
    });
  }
};

for (const root of roots) {
  await walk(path.resolve(root));
}

if (violations.length > 0) {
  console.error('Found primary buttons using text-white. Use text-[var(--color-primary-text)] or <Button>.');
  violations.forEach(({ file, line, text }) => {
    const relative = path.relative(process.cwd(), file);
    console.error(`${relative}:${line}: ${text}`);
  });
  process.exit(1);
}
