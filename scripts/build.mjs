import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sources = [
  'src/types.js',
  'src/parser.js',
  'src/matcher.js',
  'src/plan.js',
  'src/tmdb-client.js',
  'src/guangya-client.js',
  'src/bridge.js',
  'src/ui.js',
  'src/main.js'
];

const metadata = await readFile(resolve(root, 'src/userscript.meta.txt'), 'utf8');
const modules = await Promise.all(sources.map((file) => readFile(resolve(root, file), 'utf8')));
const output = `${metadata.trim()}\n\n(() => {\n'use strict';\n${modules.join('\n\n')}\n})();\n`;
const outputPath = resolve(root, 'dist/guangya-tmdb-renamer.user.js');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);
console.log(`Built ${outputPath}`);
