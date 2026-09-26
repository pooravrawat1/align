import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
if (existsSync(new URL('../.env', import.meta.url))) loadEnvFile(new URL('../.env', import.meta.url));
const children = [spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit', env: { ...process.env, PORT: '4321' } }), spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' })];
if (process.argv.includes('--quest')) children.push(spawn(process.execPath, ['../matcher/src/server.mjs'], { stdio: 'inherit', env: { ...process.env, MATCH_PORT: process.env.MATCH_PORT || '4323' } }));
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach(child => child.kill('SIGTERM')); process.exitCode = code; }
children.forEach(child => { child.on('error', () => stop(1)); child.on('exit', code => { if (!stopping) stop(code ?? 1); }); });
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
