import { readFileSync } from 'node:fs';

const fixtures = JSON.parse(readFileSync(new URL('../../assets/quest-demo-fixtures.json', import.meta.url), 'utf8'));
const [firstId = 'alex', secondId = 'maya'] = process.argv.slice(2);
const profileA = fixtures.profiles[firstId];
const profileB = fixtures.profiles[secondId];
if (!profileA || !profileB || firstId === secondId) {
  console.error('Choose two different fixture IDs: alex, maya, sam');
  process.exitCode = 1;
} else {
  const base = process.env.MATCH_URL ?? 'http://127.0.0.1:4323';
  try {
    const response = await fetch(`${base}/match`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileA, profileB }),
      // Live mode can allow up to 30 seconds; pose polling stays separate.
      signal: AbortSignal.timeout(35000),
    });
    const result = await response.json();
    console.log(JSON.stringify({
      httpStatus: response.status,
      source: response.headers.get('x-align-match-source'),
      result,
    }, null, 2));
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`Matcher unreachable: ${error.message}`);
    process.exitCode = 1;
  }
}
