# Catalyst

<!-- impeccable:product-schema 1 -->

## Platform
web

This folder is an interactive website and browser preview of a planned Unity / Meta Quest 2 app. The user expanded the original PRD to include a companion website, sign-in, profile entry, and a connection network.

## Stack
Implementation choice for this preview: React, TypeScript, Vite, and a local Node HTTP service with a server-side Gemini adapter. Local navigation works without credentials; generated compatibility needs a server-side Gemini key. Final Quest stack remains Unity, C#, Meta XR and a multiplayer integration to be selected with the repository.

## Users and purpose
Colocated hackathon and conference attendees discover people with complementary, explicitly entered interests and skills. Judges must understand the mechanism quickly.

## Confirmed journey
Join an event by code; enter or select a profile; calibrate at a shared marker; see nearby participant cards; receive a symmetric positive match with a short concrete explanation. Nonmatches remain neutral. Recalibration, reconnection, rerun, known demo match, and session reset are required.

## Brand commitments
Spatial Salon: Cursor restraint, Apple Vision Pro spatial depth, Linear product discipline, Luma event clarity, Mesh relationship memory, Cosmos network atmosphere. The final hybrid uses neutral charcoal #101113, gray surface #191A1D, white #F2F3F5, muted #A8ABB2, jade #69E6A6. The user explicitly rejected dark green backgrounds in favor of Linear-like neutral layers. Use Geist for large moments and Inter for interfaces. Glass belongs to short spatial surfaces; forms and long reading surfaces are opaque. Jade signals a reason to meet, readiness, or live state; a private estimate, never a public ranking. User references and the expanded four-tab / spatial-state plans supersede the initial draft. The later explicit approval combines v1 proportions and nested containers with v2 typography and interactions, with event phases derived from timestamps and a persistent saved-people recap.

## Preview scope
Public landing page, demo sign-in, event home, editable profile, connection graph and list, join/create session, simulated calibration, room view with distance-based card detail, match detail, people list, settings, and demo controls. The local API owns session profiles; one Gemini assessment service owns evidence-backed explanations and the weighted rubric. Illustrative room imagery and participant data are clearly demo content. Login and connections are demo-only; production auth and long-term persistence are not implemented.

## Explicit exclusions
Real passthrough, headset tracking, coordinate transforms, Photon networking, physical calibration, production authentication, Quest performance/device proof, publishing, and persistent social graphs. Browser CSS glass is a design reference, not a tested Quest rendering implementation.

## Evidence
User PRD version 1.0, the later four-tab plan and complete AR-state journey, the named Spatial Salon design direction, and the attached Apple/Cursor/spatial glass/signup references. Alex and Maya profiles and known explanation originate in the PRD. Additional profiles are fictional demo content.

## Principles
Let the physical scene lead. Keep explanations specific and under 30 words. Use only entered profile fields. Never present mock results as live AI. Keep session data ephemeral.

## Companion navigation
Home opens on the prepared event hero with Enter room, followed by Your focus, Recent connections and Other events. Find collaborators opens event people; recaps remain in event details. Events owns browse/detail/join. Network preserves the approved people/map UI and holds saved contacts across events. Profile owns introduction, optional networking goals and sharing. See `docs/event-workspace.md`.
