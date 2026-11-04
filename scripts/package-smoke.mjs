import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(join(tmpdir(), 'file-streams-react-consumer-'));
const npm = (args, cwd = root) => execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
try {
  const base = resolve(root, '../file-streams/browser');
  const basePack = JSON.parse(npm(['pack', '--json', '--pack-destination', temporary], base))[0];
  const ownPack = JSON.parse(npm(['pack', '--json', '--pack-destination', temporary]))[0];
  if (!ownPack.files.some(f => f.path === 'dist/index.d.ts')) throw Error('Missing declarations');
  npm(['init', '-y'], temporary);
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', join(temporary, basePack.filename),
    join(temporary, ownPack.filename), 'react@19.3.1', 'react-dom@19.3.1'], temporary);
  const manifest = JSON.parse(await readFile(join(temporary, 'node_modules/@59alex/file-streams-react/package.json'), 'utf8'));
  const entry = await readFile(join(temporary, 'node_modules/@59alex/file-streams-react/dist/index.js'), 'utf8');
  if (!entry.startsWith("'use client';")) throw Error('Missing client boundary directive');
  if (manifest.peerDependencies['@59alex/file-streams'] !== '^0.1.0') throw Error('Invalid published peer');
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import React from 'react';
    import { renderToString } from 'react-dom/server';
    import { FileUpload } from '@59alex/file-streams-react';
    const html = renderToString(React.createElement(FileUpload, { objectsUrl: 'https://example.invalid/objects', maxBytes: 100, objectKey: 'a' }));
    if (!html.includes('type="file"')) throw Error('Consumer render failed');
  `], { cwd: temporary, stdio: 'inherit' });
  console.log('Clean packed consumer: imports, declarations, semver peer and SSR passed');
} finally { await rm(temporary, { recursive: true, force: true }); }
