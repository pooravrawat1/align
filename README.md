<p align="center">
  <img src="docs/brand/catalyst-logo.png" alt="Catalyst" width="420">
</p>

<h3 align="center">Your people. In plain sight.</h3>

<p align="center">
  Look at someone through your headset. See a shared green cue and one reason to say hello.
</p>

<p align="center">
  <a href="https://catalystathackgt.vercel.app">Live web demo</a>
  &nbsp;·&nbsp;
  <a href="assets/LAPTOP_RELAY_DEMO.md">Two-headset demo guide</a>
  &nbsp;·&nbsp;
  <a href="assets/match-prd.md">Product spec</a>
</p>

<p align="center">
  <img alt="Meta Quest 2" src="https://img.shields.io/badge/Demo%20hardware-Quest%202-000?logo=meta&logoColor=white">
  <img alt="Unity 6000.0" src="https://img.shields.io/badge/Unity-6000.0.66f2-000?logo=unity&logoColor=white">
  <img alt="Gemini" src="https://img.shields.io/badge/Gemini-matching-4285F4?logo=googlegemini&logoColor=white">
  <img alt="ElevenLabs" src="https://img.shields.io/badge/ElevenLabs-spoken%20match-000">
</p>

<sub align="center"><i>Formerly known as Align. The Unity project, APK filename, and Android package still use the Align name.</i></sub>

---

## Why this exists

Big events put you in a room with the right people. They give you no way to find them.

Catalyst fixes the finding part. You look at someone who opted into the event. Your headset works out who you're facing. Gemini reads what both of you wrote about yourselves and returns one shared result: a match, or a quiet nothing. On a match, you both get the same green cue and one concrete reason to talk. Nobody gets ranked in public.

## Try it in a browser

The [live web demo](https://catalystathackgt.vercel.app) is the full companion experience. 400 seeded attendees, backed by MongoDB Atlas. No headset needed.

1. Open the site and choose **Try the demo**.
2. Continue with the prepared **Alex** profile.
3. Explore Home, Events, Network, and Profile.
4. Open **Spatial preview** and enter `DEMO` to walk the room in your browser.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/01-landing.png" alt="Landing page: Your people. In plain sight."></td>
    <td width="50%"><img src="docs/screenshots/02-home.png" alt="Home tab with event card, recent connections, and focus"></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/03-profile.png" alt="Profile editor with a live spatial card preview"></td>
    <td width="50%"><img src="docs/screenshots/04-spatial.png" alt="Spatial preview with floating name labels in a room"></td>
  </tr>
</table>

## How it works

```mermaid
flowchart LR
  wearer["You look at someone"]
  vision["On-device vision\nwho you are facing"]
  matcher["Matcher"]
  gemini["Gemini\nscore, route, one reason"]
  voice["ElevenLabs\nspoken match"]
  web["Web companion"]
  api["Session API"]
  mongo[("MongoDB Atlas")]

  wearer --> vision
  vision --> matcher
  matcher -->|"both profiles"| gemini
  gemini -->|"score and one reason"| matcher
  gemini -->|"same sentence"| voice
  web --> api
  api --> matcher
  api --> mongo
```

- **Look, don't tap.** Vision finds who you're facing among people who opted in. You don't press anything. The Quest demo uses controllers only because that headset has no better way to say "this person."
- **Gemini makes the call.** It gets both profiles and returns structured JSON: a 0 to 100 score across the six [rubric](assets/align-matching-rubric.md) categories, the route it took, and one conversation starter grounded in what both people wrote. 70 or above is a match. You get the sentence. The number stays hidden.
- **Nobody stands around waiting.** The call has a 3-second budget. If Gemini is slow or the response breaks the schema, the rubric returns the same shape of result. `npm run start:demo` runs that offline path.
- **You can hear it.** The match is already one short sentence, so ElevenLabs reads it out. Someone with low vision hears who this is and why to say hello instead of hunting for a card.

## Privacy

You only match with people who opted into the event. Gemini sees the interests, skills, and experiences they wrote. Never contact info or social links. The score stays private. The cue and the sentence are all either of you gets.

## Tech stack

**Where it runs**
- Designed for glasses like Meta Ray-Bans and newer Meta headsets
- Demo on Meta Quest 2 (Unity `6000.0.66f2`, OpenXR, passthrough) proving a shared room and a live match
- On-device vision to find who you're looking at

**Matching**
- Gemini (`gemini-3.8-flash`) returns score, route, and one conversation starter as structured JSON
- Node.js 20.6+ matcher (`matcher/`) enforces the schema, the 3-second deadline, and the rubric fallback
- ElevenLabs speaks the match sentence

**Web companion**
- React 19, TypeScript, Vite
- Node HTTP session API as a Vercel serverless function
- MongoDB Atlas for the 400-person seeded catalogue, in-memory fallback for tests

## Run it locally

**Web companion**

```sh
cd web
npm ci
npm run dev
```

Open `http://127.0.0.1:4320`. Use the Alex profile and room code `DEMO`. [web/README.md](web/README.md) covers the API port, tests, and the `MONGODB_URI` env var.

**Matcher**

```sh
cd matcher
npm run start:demo
```

This forces the rubric fixture so a run finishes with no network. For live Gemini matching, put a key in `.env` and run `npm run start:env`. Setup is in [matcher/README.md](matcher/README.md).

**Unity client**

1. Open `unity/` in Unity `6000.0.66f2` with Android Build Support installed.
2. Start the matcher first.
3. Choose **Align → Setup → Configure Quest Project**, then **Align → Build → Build Quest APK**.

The build lands in `unity/Builds/Quest/Align.apk`. Controller mapping and EditMode tests are in [unity/README.md](unity/README.md).

## Repo map

| Folder | What lives here |
| --- | --- |
| [`unity/`](unity/) | Mixed-reality client, Quest scenes, EditMode tests, generated APKs |
| [`matcher/`](matcher/) | Node HTTP matching service, rubric, Gemini adapter, LAN room relay |
| [`web/`](web/) | React + Vite companion site and Vercel deployment |
| [`assets/`](assets/) | Rubric, PRD, task plan, demo fixtures, laptop-relay walkthrough |

## Team

Built in 24 hours at HackGT. Ownership from [assets/TASKS.md](assets/TASKS.md):

- **Quest / MR lead:** Unity project, Quest builds, passthrough, profile-card rendering
- **Multiplayer / spatial lead:** room networking, pose sync, interpolation, calibration
- **Backend / AI lead:** profile and match schema, Gemini matching, rubric fallback, MongoDB catalogue
- **UX / demo / integration lead:** profile creation UI, demo flow, match states, recovery controls, QA

## Documentation

- [Cable-free laptop relay setup and demo walkthrough](assets/LAPTOP_RELAY_DEMO.md)
- [Product requirements](assets/match-prd.md)
- [24-hour execution plan](assets/TASKS.md)
- [Matching rubric](assets/align-matching-rubric.md)
- [Unity client setup](unity/README.md)
- [Quest matcher and Unity handoff](matcher/README.md)
- [Interactive web companion](web/README.md)
