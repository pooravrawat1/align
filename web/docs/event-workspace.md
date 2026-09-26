# Catalyst event workspace

The demo opens with The Builders Room ready on Home: meet people at the event, find a reason to connect, exchange a request, then follow up.

- **Home:** restored photographic event hero, profile card, Enter room, Your focus, Recent connections and Other events. Fresh demo sessions feature The Builders Room immediately; viewing it does not create room presence. Enter room joins it explicitly. Meet people opens the event roster; it joins only when you are not already on that roster. A selected event takes precedence. Find collaborators opens the event roster; Event details opens its recap. People and recap deep links remain supported without replacing the main dashboard with workspace tabs.
- **Events:** existing photographic event browsing, pill-shaped code entry, event details, calendar export, explicit join, and each event’s recap. Browsing never silently switches the active event.
- **Network:** the approved charcoal panel and title-row search, People by default, Map second, pill filters and sort. Saved profiles and accepted connections share this directory. Received and sent requests have a separate inbox above it. Discovery belongs to an event.
- **Profile:** existing sectional editor, draft recovery, sharing and contact controls; optional networking goals, domains, and self-declared past experiences use the same save/discard, draft recovery, and sharing lifecycle.
- **Full profiles:** one centered dialog across Home, event people, recap and Network; close returns to the original query, scroll context and trigger. No intermediate side preview.

The selected event (`activeEventId`) outlives transient spatial presence (`code`). Leaving clears presence/calibration, not the selected workspace or saved people. Saving records a validated event provenance and never sends a message. Recaps distinguish accepted connections, private saves, and pending requests; they do not claim a conversation happened. Completed follow-ups remain in the saved directory. Reminders are local metadata, not delivered notifications.

## Connecting and following up

Open any eligible event profile, including a saved profile in Network, and choose **Request to connect**. The other identity can accept or decline from Network or the profile. The sender can cancel while pending. Repeated or crossed requests reuse the same request; acceptance adds each person to the other's Network. **Save profile** is a separate private bookmark and never sends a request. Removing that bookmark does not disconnect an accepted relationship.

The inbox refreshes on tab focus, with an explicit Refresh requests action. Accepted profiles expose only the contact channels their owner has chosen to share. Follow up opens the existing message draft, private notes, status, and date; Catalyst does not send messages or reminder notifications.

Event recaps attribute saves to their recorded event and requests to the event where that request began; a connection is global, not duplicated at every later event. A profile can be both connected and saved, so those counts can overlap. Reset and event-data clearing remove the corresponding shared request records as well as owner metadata.

## Shared matcher and Gemini

The web adapter in `server/assessment.mjs` calls the same `createMatcher().assess()` engine that powers Quest `POST /match`. It replaces the separate web Gemini prompt and scoring implementation. The Quest HTTP contract remains exactly `{userA,userB,compatible,score,reason}`; richer web details stay behind the authorized `POST /api/compatibility` endpoint.

`assets/matching-policy.json` owns the 70-point match threshold used by the matcher, web spatial matching, and green web scores. The final score is the strongest of networking fit, professional shared experience, and personal shared experience. The web breakdown shows these routes separately; it never represents an experience score as the sum of the six networking categories.

Web `id` maps to `userId`, selected goals map to the bounded `networkingGoal` string, and optional domains/experiences pass through only when shared. Nothing automatically records attendance at the current event as a past experience. Fictional Alex/Maya/Sam gain the fixture's domains/experiences; their existing web goals remain editable. Contact details, photos, location and private notes never enter the matcher.

Gemini supplies grounded networking criteria and a short reason. Shared-interest chips and reciprocal contributions are computed from supplied fields. `gemini`, `rules`, and `fixture` provenance survive cache hits; the UI labels only the model-generated networking result as AI. An unavailable networking route has null points. Without AI or qualifying experience evidence, compatibility stays unavailable rather than becoming a zero. Exact offline fixture nonmatches remain actual zero results. The web spatial response likewise uses `score:null` for unassessed peers (numeric spatial scores retain their existing 0–1 scale).

The matcher bounds successful cache entries to 256 with a 30-minute TTL and deduplicates in-flight pairs. The web adapter briefly caches unavailable results and supports explicit retry. Automatic spatial matching assesses at most three candidates ranked by reciprocal overlap and shared experiences; other attendees remain neutral. Operator fixture mode uses the same engine with Gemini disabled.

Copy `.env.example` to `.env` and configure `GEMINI_API_KEY` locally. The key stays server-side. Web assessments default to a 15-second deadline, capped at 15 seconds via `GEMINI_TIMEOUT_MS`; the standalone Quest matcher retains its three-second deadline. Live Gemini still requires a key and live verification.

Run `npm run dev` for web/API on ports 4320/4321. Run `npm run dev:quest` to additionally start the standalone Quest matcher on port 4323 using the same environment. `MATCH_PORT` can override its port. The separate review URL at port 4332 proxies the API on 4321. The Quest client uses the laptop LAN address and `/match`; browser profile/session APIs stay on the web server. Sharing an engine is not web-to-Quest identity or state synchronization.

## Boundaries and verification

The local service still uses temporary sessions and fictional seed profiles. Profile values and sharing choices are owned by identity within the running server. Requests and accepted relationships are shared between identities; bookmarks, notes, follow-up dates and drafts remain private. State is not durable across server restarts. This is not production authentication, persistent storage, realtime attendance, a deployed service or a working Quest client. The browser spatial preview preserves calibration/recovery interaction states but does not prove headset behavior.

Focused Node tests cover assessment authorization, privacy, schema/evidence, failure recovery, deduplication, bounded calls, stale responses, event provenance, recap ownership, goals and spatial selection. Browser tests cover Home/Event/Network navigation, full profiles, filters, recaps, drafts and desktop/mobile layout. Live Gemini requires a configured key; mocked HTTP tests are not a live-model result.
