# Align — Spatial Salon

An interactive companion website and browser simulation of the Align mixed-reality introduction experience. This is a UI-first MVP with a local, deterministic mock service—not a Quest application or production backend.

## Run

```sh
npm ci
npm run dev
```

- Website: http://127.0.0.1:4320
- Mock service: http://127.0.0.1:4321
- A stable built preview can run with `npm run build` then `npm run preview -- --port 4322` while the mock service is running.

## Try the main journey

1. On the landing page, scroll through the illuminated visor journey or select **See how it works**.
2. Select **Try the demo** or **Step inside**, then continue with a prepared profile.
3. Explore Home, Event, Network, and Profile. Edit and save your introduction; its spatial preview updates as you type.
4. Open Spatial preview. Join `DEMO`, confirm your profile, simulate calibration, and enter the room.
5. Find connections, open Maya, start a conversation, and save the connection.
6. Finish the conversation or leave the room. Find Maya in Network, open the full profile, and save private notes and a follow-up date.
7. The spatial Demo panel exposes simulated connection/alignment/boundary interruptions and demo recovery controls.

The website uses temporary demo identities. No password, OAuth service, invitation, email, push notification, or contact-sharing request is sent. A follow-up date is stored only as local-session metadata. Restarting the mock service resets demo sessions; the reset control restores sample content.

## Checks

```sh
npm test
npm run build
```

HTTP tests exercise the in-memory API. A browser preview can establish composition and interaction behavior. Neither proves Quest passthrough, tracking, shared-origin alignment, physical safety, controller targeting, performance, or multiplayer synchronization.

## Architecture

`src/App.tsx` owns navigation, the session, the request queue, and feedback. `ProductPages` owns Home/Event; `PersonalPages` owns Network/Profile; `Spatial` owns the simulated spatial-state flow. `server/index.mjs` owns temporary sessions, room state, profiles, cached matching, and personal connection records. `shared/demo-data.json` holds the fictional fixtures.

`src/theme.css` owns the unified color and typography tokens over reusable layout primitives in `styles.css`. `Landing.css`, `ProductPages.css`, `PersonalPages.css`, and `SpatialV2.css` own their respective compositions. Geist and Inter are self-hosted from Fontsource packages. The product presents one unified interface. Prior drafts are preserved separately in the original local workspace.

See [product scope](PRODUCT.md), [implementation boundaries](docs/IMPLEMENTATION.md), and [asset provenance](docs/ASSETS.md). This companion prototype lives in `web/` in the Align repository; the repository’s existing Unity requirements and execution plan remain authoritative for headset implementation.

## Cinematic public landing

The approved V3 landing is now the Align front page. Its fullscreen room photograph, illuminated visor, Maya marker-to-contact transition and deliberate scroll checkpoints are scoped to the public route. The existing Align branding and login callback are reused; current Home, Event, Network, Profile and Spatial implementations remain in place. Below 900px and with reduced motion, the story uses the normal linear reading layout.

GSAP owns the scroll timeline; Three.js renders the optical surface with an aligned SVG fallback. The illustrative photograph's provenance is in `public/assets/hero-room-v3.webp.json`. Development-only version comparison links remain in the separate V3 project and are not shown on Align.

No builds, tests, browser verification or Playwright were run for this integration, per the user's instruction.
