import { cp, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Preserve the repo's web/matcher/assets import layout inside the Node function.
// Copy an explicit source inventory: never include local environment files.
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(web, '..');
const target = await mkdtemp(join(tmpdir(), 'catalyst-conference-preview-'));
const output = join(target, '.vercel/output');
const api = join(output, 'functions/api/index.func');
await mkdir(api, { recursive: true });
await cp(join(web, 'dist'), join(output, 'static'), { recursive: true });
for (const directory of ['web/server', 'web/shared', 'matcher/src']) {
  await mkdir(dirname(join(api, directory)), { recursive: true });
  await cp(join(repo, directory), join(api, directory), { recursive: true });
}
await mkdir(join(api, 'assets'), { recursive: true });
for (const file of ['matching-policy.json', 'quest-demo-fixtures.json']) {
  await cp(join(repo, 'assets', file), join(api, 'assets', file));
}
await writeFile(join(api, 'index.mjs'), "import { createRequestHandler } from './web/server/index.mjs';\nexport default createRequestHandler();\n");
await writeFile(join(api, '.vc-config.json'), JSON.stringify({ runtime: 'nodejs24.x', handler: 'index.mjs', launcherType: 'Nodejs', maxDuration: 30 }));
await writeFile(join(output, 'config.json'), JSON.stringify({ version: 3, routes: [{ src: '/api/(.*)', dest: '/api/index' }, { handle: 'filesystem' }, { src: '/(.*)', dest: '/index.html' }] }));
await cp(join(web, '.vercel/project.json'), join(target, '.vercel/project.json'));
await writeFile(join(target, 'package.json'), JSON.stringify({ name: 'catalyst-conference-preview', private: true, type: 'module' }));
console.log(target);
