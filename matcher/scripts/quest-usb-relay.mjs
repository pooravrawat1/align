import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);
const unityAdb = '/Applications/Unity/Hub/Editor/6000.0.66f2/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb';
const adbPath = process.env.ALIGN_ADB_PATH || (existsSync(unityAdb) ? unityAdb : 'adb');
const once = process.argv.includes('--once');
const serials = [...new Set(process.argv.slice(2).filter((arg) => arg !== '--once'))];

if (!serials.length || serials.some((serial) => !/^[A-Za-z0-9._:-]+$/.test(serial))) {
  console.error('Usage: npm run relay:usb -- [--once] <headset-serial> [<headset-serial> ...]');
  process.exit(1);
}

const states = new Map();
let stopped = false;
let timer;

function report(key, message) {
  if (states.get(key) === message) return;
  states.set(key, message);
  console.log(`[Quest USB relay] ${key}: ${message}`);
}

async function adb(args) {
  const { stdout } = await run(adbPath, args, { timeout: 6000, maxBuffer: 128 * 1024 });
  return stdout;
}

async function maintain() {
  let ready = true;
  try {
    const connected = new Map((await adb(['devices'])).split('\n')
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length >= 2));
    report('ADB', 'available');

    for (const serial of serials) {
      if (stopped) return false;
      const state = connected.get(serial);
      if (state !== 'device') {
        ready = false;
        report(serial, state === 'unauthorized'
          ? 'Accept USB debugging in the headset; select Always allow from this computer.'
          : `Waiting for USB connection (${state || 'disconnected'}).`);
        continue;
      }

      try {
        const mappings = await adb(['-s', serial, 'reverse', '--list']);
        const hasRelay = mappings.split('\n').some((line) =>
          line.trim().split(/\s+/).slice(-2).join(' ') === 'tcp:4323 tcp:4323');
        if (!hasRelay) {
          await adb(['-s', serial, 'reverse', 'tcp:4323', 'tcp:4323']);
          report(serial, 'Restored USB relay on port 4323.');
        } else {
          report(serial, 'USB relay ready on port 4323.');
        }
      } catch (error) {
        ready = false;
        report(serial, `Waiting to restore forwarding: ${error.stderr?.trim() || error.message}`);
      }
    }
  } catch (error) {
    ready = false;
    report('ADB', `Retrying: ${error.stderr?.trim() || error.message}`);
  }
  return ready;
}

async function tick() {
  await maintain();
  if (!stopped) timer = setTimeout(tick, 2500);
}

function stop() {
  stopped = true;
  clearTimeout(timer);
  console.log('[Quest USB relay] Watcher stopped; existing forwards were left in place.');
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

if (once) {
  process.exitCode = await maintain() ? 0 : 1;
} else {
  console.log(`[Quest USB relay] Watching ${serials.join(', ')}. Keep the matcher running and USB cables connected.`);
  await tick();
}
