import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const distAssetsDir = path.join(projectRoot, 'dist', 'assets');

const moveLayerPropertiesToEnd = (css) => {
  const marker = '@layer properties{';
  const start = css.indexOf(marker);
  if (start === -1) return css;

  let i = start + marker.length;
  let depth = 1;
  while (i < css.length && depth > 0) {
    const ch = css[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    i += 1;
  }

  if (depth !== 0) return css;

  const block = css.slice(start, i);
  const rest = css.slice(0, start) + css.slice(i);
  return rest + block;
};

const main = async () => {
  let entries;
  try {
    entries = await fs.readdir(distAssetsDir, { withFileTypes: true });
  } catch {
    return;
  }

  const cssFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.css'))
    .map((e) => path.join(distAssetsDir, e.name));

  await Promise.all(
    cssFiles.map(async (filePath) => {
      const css = await fs.readFile(filePath, 'utf8');
      const next = moveLayerPropertiesToEnd(css);
      if (next !== css) {
        await fs.writeFile(filePath, next, 'utf8');
      }
    })
  );
};

await main();
