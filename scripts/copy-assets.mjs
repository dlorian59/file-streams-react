import { copyFile } from 'node:fs/promises';
await copyFile(new URL('../src/styles.css', import.meta.url), new URL('../dist/styles.css', import.meta.url));
await copyFile(new URL('../src/styles.d.ts', import.meta.url), new URL('../dist/styles.d.ts', import.meta.url));
