# Align — Spatial Salon

An interactive companion website and browser simulation of the Align mixed-reality introduction experience. This is a UI-first MVP with a temporary local session service and the shared Quest matching engine. It is not a Quest client or production backend.

## Run

```sh
npm ci
npm run dev
```

- Website: http://127.0.0.1:4320
- Session API: http://127.0.0.1:4321
- `npm run dev:quest` also starts the Quest matcher at port 4323. Both services use the shared matcher engine; profile and connection state is not synchronized to Quest.
- A stable built preview can run with `npm run build` then `npm run preview -- --port 4322` while the mock service is running.

## Try the main journey

1. On the landing page, scroll through the illuminated visor journey or select **See how it works**.
2. Select **Try the demo** or **Step inside**, then continue with a prepared profile.
3. Explore Home, Event, Network, and Profile. Edit and save your introduction; its spatial preview updates as you type.
4. Open Spatial preview. Select **Enter preview** for a joined event, or enter `DEMO` to join and explore. No browser calibration is required.
5. Select a frosted profile card, or open **People** to choose anyone in the event. Green indicates a reason to meet; it does not save a person.
6. Review shared interests and complementary skills, then **Save connection**. The confirmation appears after the save succeeds. This is a private save to your Network, not a mutual connection request.
7. Select **Back to event** to leave the preview. Your event, profile, and saved people remain available. Use Network for notes and follow-up.
8. **Preview controls** contains distance, a prepared sample match, appearance, and simulated connection/alignment/boundary interruptions. **Restore preview** resumes the room without physical calibration.

The website uses temporary demo identities. Connection requests work between local identities. No password, OAuth service, external invitation, email, or push notification is sent. A follow-up date is stored only as local-session metadata. Restarting the mock service resets demo sessions; the reset control restores sample content.

## Shared match narration

For genuinely AI-written introductions, also set `GEMINI_API_KEY` and
`MATCH_MODE=live`. This requires Gemini text even for the prepared demo;
failures leave matching unavailable rather than silently using scripted prose.
The existing scoring rubric still applies. `auto` and `fixture` modes may use
templates/precomputed text. Both Gemini and ElevenLabs keys remain server-only.

Set `ELEVENLABS_API_KEY` in **web/.env** (use `.env.example` for the full settings)
and restart `npm run dev` or `npm run dev:quest`. The key needs Text to Speech
access and available credits. `ELEVENLABS_VOICE_ID` optionally selects another
female voice; the default is Sarah. No key is exposed to the browser. Deployments
must configure the same variables on the API server.

Spatial preview reads the shared introduction for each new match once.
Narration starts after **Enter preview**, queues multiple matches, and does not
repeat on Refresh matches. Use **Read match introductions aloud** before entry or the
speaker button afterward to mute; the preference stays on this browser. Starting
a conversation, leaving, or losing the match stops audio. If the browser blocks
autoplay, select **Play match introductions**; if generation fails, **Retry audio** retries
without disrupting matching. The existing optional Match sound chime is separate.

`POST /api/narration` takes `{ "participantId": "maya" }` with `x-session-id` and
returns MP3 audio. The server requires a current compatible match in the joined
event, rejects stale matches after privacy changes, and rechecks authorization
after generation. Only the current match reason goes to ElevenLabs; individual
bios and raw matching inputs are excluded. Both participants hear the same
introduction. Generation and bounded caching are shared with the Quest service
implementation. See [matcher setup](../matcher/README.md#shared-match-narration-elevenlabs).

## Checks

```sh
npm test
npm run build
```

HTTP tests exercise the in-memory API. A browser preview can establish composition and interaction behavior. Neither proves Quest passthrough, tracking, shared-origin alignment, physical safety, controller targeting, performance, or multiplayer synchronization.

## Architecture

`src/App.tsx` owns navigation, the session, the request queue, and feedback. `ProductPages` owns Home/Event; `PersonalPages` owns Network/Profile; `Spatial` owns the simulated spatial-state flow. `server/index.mjs` owns temporary sessions, room state, canonical profiles, authorized matching, connection requests, and personal connection records. `server/assessment.mjs` projects shared fields into the engine in `../matcher/`, preserving the headset HTTP contract. `shared/demo-data.json` holds the fictional fixtures.

`src/theme.css` owns the unified color and typography tokens over reusable layout primitives in `styles.css`. `Landing.css`, `ProductPages.css`, `PersonalPages.css`, and `SpatialV2.css` own their respective compositions. Geist and Inter are self-hosted from Fontsource packages. The product presents one unified interface. Prior drafts are preserved separately in the original local workspace.

See [current event and matcher integration](docs/event-workspace.md), [product scope](PRODUCT.md), [implementation boundaries](docs/IMPLEMENTATION.md), and [asset provenance](docs/ASSETS.md). This companion prototype lives in `web/` in the Align repository; the repository’s existing Unity requirements and execution plan remain authoritative for headset implementation.

## Cinematic public landing

The approved V3 landing is now the Align front page. Its fullscreen room photograph, illuminated visor, Maya marker-to-contact transition and deliberate scroll checkpoints are scoped to the public route. The existing Align branding and login callback are reused; current Home, Event, Network, Profile and Spatial implementations remain in place. Below 900px and with reduced motion, the story uses the normal linear reading layout.

GSAP owns the scroll timeline; Three.js renders the optical surface with an aligned SVG fallback. The illustrative photograph's provenance is in `public/assets/hero-room-v3.webp.json`. Development-only version comparison links remain in the separate V3 project and are not shown on Align.

No builds, tests, browser verification or Playwright were run for this integration, per the user's instruction.
