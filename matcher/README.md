# Align Quest matcher

This is the Person 3 service for the **two-Quest demo**. It is separate from the
finished `web/` browser simulation. Node 20.6+ is required; there are no npm
dependencies. The rubric is in [assets/align-matching-rubric.md](../assets/align-matching-rubric.md),
and the one canonical Alex/Maya/Sam fixture is
[assets/quest-demo-fixtures.json](../assets/quest-demo-fixtures.json).

## Start and check

From this directory:

```sh
npm run start:demo
```

`start:demo` forces fixture mode and does not load `.env` or call Gemini.
Describe those results as scripted demo results, not live AI. Never show the API key.

The current physical demo also sets `MATCH_MODE=fixture` in `matcher/.env` and
runs `npm run start:env`, so ElevenLabs remains enabled while Gemini is skipped.
Alex/Maya receive the reviewed shared introduction from
`assets/quest-demo-fixtures.json`; Alex/Sam and Maya/Sam remain nonmatches.

For live AI introductions, copy `.env.example` to `.env`, put the key in the local
`.env` file, then run `npm run start:env`. Do not commit `.env` or put the key
in a Quest build. Set `MATCH_MODE=live`, `GEMINI_MODEL=gemini-3.8-flash`, and
`GEMINI_TIMEOUT_MS=15000`. Live mode uses the
[Gemini Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview)
with stateless structured output. Gemini evaluates networking fit and writes
the shared introduction in one request. The existing rubric still determines
the winning score. Without the fallback opt-in below, the displayed/spoken
introduction must be AI-generated, even when a shared-experience rule wins.
No fixture result overrides a valid live output.
Live deployments may raise `GEMINI_TIMEOUT_MS` up to 30000 for a slower model;
the background relay keeps pose updates responsive during generation.

Live prose must be at most 30 words and contain validated evidence from both
profiles. It is shared by both wearers and cached for the relay session (up to
256 entries), keyed by the complete profiles, model, and rubric. Unchanged
people do not consume a fresh generation every 30 minutes; profile changes
still require a new assessment. Restarting the relay clears this in-memory cache.
With fallback disabled, missing keys, timeout, invalid output, or provider failure
never produce scripted speech. The headset shows pending/unavailable status, room
poses continue updating, and failed generations normally retry after 30 seconds.
Rate limits are reported as HTTP 429 and shared across requests: temporary limits
back off for at least 30 seconds; an exhausted daily quota backs off for one hour
instead of repeatedly asking an exhausted model. Cached valid AI summaries still
work during a quota failure. Set `GEMINI_MODEL` to a model with available quota
and restart when necessary; do not use a new key to work around project quotas.
See [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).
`GET /health` reports `mode: "live"`, `geminiConfigured: true`, and
`introductionMode: "gemini-required"` when configured. `/match` still returns
the frozen result shape and `x-align-match-source: gemini` (or `cache` on reuse).

### Three-second shared-summary fallback

For a resilient demo, set these on the relay (or the web server) and restart:

```dotenv
MATCH_MODE=live
MATCH_LIVE_FALLBACK=true
MATCH_FALLBACK_TIMEOUT_MS=3000
```

These are enabled in `matcher/.env.example`; the code default remains strict
unless `MATCH_LIVE_FALLBACK` is exactly `true`. AI gets up to three seconds
(or the shorter `GEMINI_TIMEOUT_MS`) to return a valid summary. On timeout,
missing credentials, invalid output, or an API error, the server uses the
existing shared-experience templates. For Alex/Maya this is “You both attended
Build Together in 2025. What stayed with each of you from it?” It never reads
their individual bios or treats unrelated people as a match. Edited profiles
are scored from their current shared fields, not just their demo IDs.

Slow requests are aborted. The chosen result, including a fallback, is cached
for the relay session and shared by both headsets; a late AI answer cannot
replace it during narration or trigger another speech playback. Profile edits
or restarting the relay allow a fresh attempt; unchanged cached fallbacks do
not automatically upgrade to AI. Cache clearing is also available internally.
`/health` reports `introductionMode: "gemini-with-fallback"` and
`fallbackAfterMs: 3000`; `/match` uses source `fallback` on first delivery, and
cached assessments retain `rules` provenance. Do not describe that text as
AI-generated. Quota cooldowns still apply, with immediate fallback during them.
No headset rebuild is needed, and A/X dismissal works exactly as for AI prose.
This is a text fallback only; ElevenLabs still needs internet and API credits
to speak it.

Legacy `MATCH_MODE=auto` tries Gemini and permits fixture/rule fallback; it does
not guarantee AI-written prose. `MATCH_MODE=fixture` forces scripted demo
results even with a key. The default mode remains `auto` unless configured.

The default address is `0.0.0.0:4323` so headsets on the **same private Wi-Fi or
hotspot** can reach the laptop. The Unity URL is
`http://<LAPTOP_LAN_IP>:4323` for a LAN build. Verify the
laptop's LAN IP and firewall, and confirm Unity's Android build permits the
chosen local HTTP connection. The HTTP endpoint has no authentication; use a
private demo network and fictional profiles.

For the current USB demo build (`http://127.0.0.1:4323` inside each Quest), keep
the matcher running and start this watcher in a separate terminal:

```sh
npm run relay:usb -- 1WMHH8117K0363 1WMHHB65B82106
```

It checks only the named headsets every 2.5 seconds and restores their
`tcp:4323` USB reverse mappings after reconnects or Unity restarting ADB.
Keep both USB cables connected. If a headset is unauthorized, accept USB
debugging in the headset and select **Always allow from this computer**;
the watcher resumes automatically after authorization. Stop it with Ctrl+C.
Use `--once` before the serials for a single repair/check. Set `ALIGN_ADB_PATH`
if ADB is installed somewhere other than the pinned Unity SDK or your PATH.

```sh
curl http://127.0.0.1:4323/health
npm run smoke -- alex maya
npm run smoke -- alex sam
npm test
```

The same process also hosts the temporary private-LAN `POST /room/update`
endpoint used by the current Quest integration. It accepts a bounded device ID,
room code, requested demo profile, calibration flag, and calibrated pose. The
response contains the assigned profile, active participants, and one
authoritative match result. Members expire after five seconds without an
update. This endpoint has no authentication and must never be exposed outside
the private demo network.

`MATCH_URL=http://<LAPTOP_LAN_IP>:4323 npm run smoke -- alex maya` runs the
same request from another machine on the network. A real Quest-to-laptop check
still needs the Unity build and both devices.

## Shared match narration (ElevenLabs)

Copy `.env.example` to `.env` and set `ELEVENLABS_API_KEY` to a key with
Text to Speech permission and available credits. The default female voice is
Sarah (`EXAVITQu4vr4xnSDxMaL`); optionally set `ELEVENLABS_VOICE_ID` to your
preferred female voice from My Voices. `ELEVENLABS_MODEL_ID` defaults to
`eleven_flash_v2_5`. The provider request follows the
[ElevenLabs speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).

Run `npm run start:env` to load these settings. For fixture matching with live
speech, set `MATCH_MODE=fixture` in `.env` and use `start:env`; `start:demo` does
not load `.env`. When starting everything with `npm run dev:quest` from `web/`,
put the settings in **web/.env** instead; that launcher shares them with the
matcher. Restart the service after changing credentials or voice settings.

`POST /room/narration` accepts only `{ "roomCode": "DEMO", "clientId": "…",
"profileId": "maya" }` and returns `audio/mpeg`. It requires a recent tracked,
calibrated room member matched to that remote profile, after the shared reveal
has been requested. Before reveal, narration returns HTTP 403. The server reads the
shared reason from the current match and rechecks the match after
generation. No arbitrary narration text or voice selection comes from clients.
`GET /health` includes `narration.enabled`, `voiceId`, `modelId`, and
`content: "match-reason"`, never the key.

Both Quests initially show names only, even when a compatible result is ready.
After both calibrate, a fresh A/X press by either wearer requests reveal through
`POST /room/update` with `revealIntroduction: true` and the snapshot's current
`presentationId`. The relay returns `introductionRequested` and
`introductionRevealed` to both devices. If generation is pending, the request
waits for that one result; both then show and speak the same summary. Duplicate
requests never toggle it off. A reset, membership/calibration change, or profile
switch changes `presentationId`, invalidating stale queued presses. The clients
observe this through their normal room polls; rendering is not frame-locked.

Repeated room polls do not replay speech. A/X cannot hide the initial name or
interrupt narration: dismissal unlocks after the shared introduction is shown
and playback completes (or audio fails/is disabled). It requires a fresh button
press; completion alone never hides the card. Profile switches, resets, lost
tracking/connection, and disabling the controller cancel
pending or active audio. Maya → Sam → Maya reads the shared introduction again.
Rebuild/reinstall the APK to include this client behavior. Speech runs alongside
pose updates, so it does not delay matching or room polling.

The server sends only the match reason to ElevenLabs, never individual bios. Successful audio
is cached in memory for up to 30 minutes (32 clips maximum); duplicate requests
share one generation. Errors have a 30-second cooldown, requests time out after
15 seconds by default (`ELEVENLABS_TIMEOUT_MS`, maximum 30 seconds), and missing
credentials or provider failures leave the visual experience usable. There is
no offline speech fallback. Keep the key on the server, never in Unity or a
browser `VITE_*` variable. This endpoint shares the relay's private-LAN-only
security boundary.

## Frozen Unity contract

`POST /match` with `Content-Type: application/json` accepts exactly
`{ "profileA": MatchProfile, "profileB": MatchProfile }`. `MatchProfile` has
`userId`, `name`, `bio`, `interests`, `skills`, `lookingFor`, `networkingGoal`,
`domains`, and `experiences`. Every field is required; arrays may be empty.
Each experience has `category` (`professional` or `personal`), `kind`, `label`,
and optional `year`. Use past, self-declared experiences only; never add the
current room event automatically. The complete request data is in
the fixture linked above, and the smoke script sends it unchanged.

The response contains **only** `userA`, `userB`, `compatible`, `score`, and
`reason`. IDs are sorted, `score` is an integer percentage, and `reason` is
empty for a nonmatch. The `X-Align-Match-Source` header is `gemini`, `cache`, or
`fallback` for developer diagnostics; do not present a fallback as live AI.
The reviewed hardcoded Alex/Maya response in fixture mode is:

```json
{
  "userA": "alex",
  "userB": "maya",
  "compatible": true,
  "score": 100,
  "reason": "You share a vision for wearable assistive technology. Combining computer vision with embedded hardware could turn that idea into something people can use every day."
}
```

In fixture mode, Alex/Sam has `compatible: false`, `score: 0`, and an empty
`reason`; live results depend on the actual AI assessment and rubric.
Malformed, oversized, or extra fields—including social/contact/location—are
rejected before any model call. `GET /health` reports the mode, model, rubric
version, and whether a key is configured without revealing the key.

## Unity handoff

- Headset A is hard-coded to Alex. Headset B is Maya by default and can be
  switched to Sam through an **operator-only** control. No user profile editor
  or login is needed for this demo.
- The current LAN relay evaluates the pair once after both profiles are ready
  and returns the same stored result to both headsets. A future Photon
  coordinator should preserve this behavior. Render only the other
  person's name until the shared reveal, even if `compatible: true` is ready.
  Only `introductionRevealed: true` turns both cards green and shows the exact
  same reason. Never render the score or full profile. Deploy the updated relay
  and rebuild/reinstall both headset clients together for this protocol.
- On Maya ↔ Sam switch, clear the old green state and reason **before** sending
  the new profile ID and rerunning the pair. Prevent stale or duplicate results
  from applying after the switch.
- Keep pose-update requests short. In live mode the relay runs generation in
  the background and publishes pending/error status. The explicit
  `MATCH_LIVE_FALLBACK` option permits shared-experience templates, never
  individual-bio blurbs; legacy `auto` mode permits fixture fallback.
- Rehearse Maya → Sam → Maya three times on both physical headsets. A live
  Gemini call cannot be verified without a configured key; an actual LAN/Quest
  check requires the Unity teammate's build and devices.

## Privacy and scoring

Only names and match reasons appear on screen. Optional narration reads the
same shared match reason to both wearers and sends only that text to ElevenLabs.
Matching fields travel over
Photon to the coordinator and, in live mode, to Gemini; this is **not** a
zero-sharing design. The Gemini request is stateless (`store: false`) and
contains only whitelisted matching fields. The service does not log profile
text or credentials. The six networking categories score 0–100; professional
and personal experience routes are scored separately. The highest route is the
final percentage, with a 70% match threshold. Details and point rules are in
the rubric document.

## Web integration

The companion imports this engine server-side through `web/server/assessment.mjs`; it does not send browser requests directly to the unauthenticated Quest endpoint. The adapter retains session/event authorization and projects only shared matching fields. `createMatcher().assess()` exposes route scores, networking criteria, availability and winning provenance for web presentation. `match()` keeps the frozen Quest response unchanged. Both entry points share evaluation, bounded caching and request deduplication.

The threshold is owned by `assets/matching-policy.json`. Cached assessments retain their original `gemini`, `fixture`, or `rules` provenance even when the HTTP diagnostic source reads `cache`. The web may show a rich profile and score; the Quest attendee view remains name and matched reason only. No profile or connection state is synchronized to Photon by this integration.

From `web/`, `npm run dev:quest` starts web 4320, session API 4321 and this matcher 4323. It uses `web/.env` if present. Standalone startup above remains supported with its own local environment.
