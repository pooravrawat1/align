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

`start:demo` forces fixture mode and does not load `.env` or call Gemini. This
is the reliable judged-demo path. Keep the optional Gemini integration in the
code, but describe fixture results as rubric-scored demo results, not live AI.
Never show the API key.

For live-first matching, copy `.env.example` to `.env`, put the key in the local
`.env` file, then run `npm run start:env`. Do not commit `.env` or put the key
in a Quest build. `MATCH_MODE=fixture` also forces demo results when a key is
present; the default `auto` tries Gemini first and falls back within three
seconds. `GEMINI_MODEL` defaults to `gemini-3.8-flash`.

The default address is `0.0.0.0:4323` so headsets on the **same private Wi-Fi or
hotspot** can reach the laptop. The Unity URL is
`http://<LAPTOP_LAN_IP>:4323`, never `localhost` on a headset. Verify the
laptop's LAN IP and firewall, and confirm Unity's Android build permits the
chosen local HTTP connection. The HTTP endpoint has no authentication; use a
private demo network and fictional profiles.

```sh
curl http://127.0.0.1:4323/health
npm run smoke -- alex maya
npm run smoke -- alex sam
npm test
```

`MATCH_URL=http://<LAPTOP_LAN_IP>:4323 npm run smoke -- alex maya` runs the
same request from another machine on the network. A real Quest-to-laptop check
still needs the Unity build and both devices.

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
For the bundled Alex/Maya profiles, the response is:

```json
{
  "userA": "alex",
  "userB": "maya",
  "compatible": true,
  "score": 100,
  "reason": "You both attended Build Together in 2025 and care about assistive technology. How could Maya's computer vision complement Alex's wearable hardware?"
}
```

For Alex/Sam, `compatible` is `false`, `score` is `0`, and `reason` is empty.
Malformed, oversized, or extra fields—including social/contact/location—are
rejected before any model call. `GET /health` reports the mode, model, rubric
version, and whether a key is configured without revealing the key.

## Unity handoff

- Headset A is hard-coded to Alex. Headset B is Maya by default and can be
  switched to Sam through an **operator-only** control. No user profile editor
  or login is needed for this demo.
- One Photon coordinator sends one match request after both profiles are ready.
  It broadcasts the returned result to both headsets. Render only the other
  person's name before matching; on `compatible: true`, turn both name cues
  green and show the exact same reason. Never render the score or full profile.
- On Maya ↔ Sam switch, clear the old green state and reason **before** sending
  the new profile ID and rerunning the pair. Prevent stale or duplicate results
  from applying after the switch.
- Use a five-second Quest request timeout. If the laptop cannot be reached,
  use the matching `offlineResults` entry bundled from the same fixture file.
  The backend also uses these results when Gemini is missing, slow, or invalid.
- Rehearse Maya → Sam → Maya three times on both physical headsets. A live
  Gemini call cannot be verified without a configured key; an actual LAN/Quest
  check requires the Unity teammate's build and devices.

## Privacy and scoring

Only names and match reasons appear to attendees. Matching fields travel over
Photon to the coordinator and, in live mode, to Gemini; this is **not** a
zero-sharing design. The Gemini request is stateless (`store: false`) and
contains only whitelisted matching fields. The service does not log profile
text or credentials. The six networking categories score 0–100; professional
and personal experience routes are scored separately. The highest route is the
final percentage, with a 70% match threshold. Details and point rules are in
the rubric document.
