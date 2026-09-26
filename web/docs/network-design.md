# Network frontend surface

This document records the implemented Network experience in the browser preview. It is a surface-specific companion to `PRODUCT.md`, not a replacement for the project design system.

## Product and visual contract

Network belongs to the incumbent Home and Event world: neutral charcoal layers (`#101113`, `#191A1D`, and nearby raised surfaces), white and muted-gray type, Geist for large identity moments, and Inter for controls and reading. Jade is reserved for positive common ground, readiness, and live state; compatibility is contextual guidance rather than a public rank.

The map is deliberately quiet. People appear as circular portraits with names and roles, joined by restrained relationship lines. Do not add portrait rings, orbit decoration, or a visible grid. Group containers may provide faint spatial organization for Event and Shared interests, but they stay subordinate to people. Dense maps collapse into labeled clusters until the user reveals a group.

## Main behavior

- **Destinations:** Your network shows saved connections; Discover shows eligible unsaved sample attendees. Search spans visible profile fields. Filters cover event, interest, and follow-up state where applicable.
- **Views:** Saved connections can switch between Map and People. The map supports pointer panning, wheel zoom, explicit zoom controls, fit-to-network, and grouping by Connections, Event, or Shared interests. Portrait labels remain readable at different zoom levels and truncate within their node instead of overflowing on mobile.
- **Selection:** Selecting a map portrait, person row, or Discover card updates the hash route with `person`. Desktop opens a 340px side preview (310px below 1200px) over the right side of the workspace; it must not resize or reflow the map. Mobile presents the preview as a bottom sheet.
- **Preview:** The preview leads with identity, shared contacts when permitted, and an underlined **Explore profile** text action with an arrow directly beneath the identity block. It then shows compatibility context, common ground, optional project context, and Save connection.
- **Full profile:** Expanding adds `details=1` and opens a centered modal, at most 920px wide and 80dvh tall, over a dimmed and blurred backdrop. The full view combines identity, project/about content, common ground, reciprocal skills, goals, compatibility details, optional Sample AI insight, and follow-up tools. On mobile it remains inset by 12px on each side and uses contained scrolling.
- **Navigation and focus:** Escape and backdrop clicks close the active modal layer. Hash history preserves the preview-to-full-profile depth, and closing restores focus to the initiating control. Selecting or closing a person preserves page scroll; the app resets scroll only when the route page changes. Visible keyboard focus, reduced-motion handling, and reduced-transparency handling are part of the surface contract.
- **Privacy:** The frontend projects only fields allowed by profile visibility. Withdrawn people expose a private-state message instead of their shared details. Contact destinations appear only for saved, non-withdrawn connections whose contact fields are explicitly visible.

## Compatibility presentation

Compatibility is demo-authored frontend content derived from visible profile fields. The 100-point rubric is:

| Category | Points |
| --- | ---: |
| Reciprocal skill fit | 30 |
| Networking goals | 25 |
| Project synergy | 15 |
| Mutual value | 15 |
| Shared interests | 10 |
| Conversation potential | 5 |

Known unchanged sample profiles may receive authored category points and a total score. Other profiles show partial or unavailable states instead of fabricating a score. **Sample AI insight** is optional disclosure content: it offers a sample suggestion and message starter from visible fields, and must retain the statement that no live AI request occurs.

## Source ownership

- `src/NetworkPage.tsx` owns destinations, search/filter/sort state, map/list switching, selection history, dialog mode, save-connection admission, and composition of the browser, map, cards, rows, and profile.
- `src/NetworkPage.css` owns the Network shell, incumbent charcoal styling, responsive card/list layouts, side-preview overlay geometry, full-profile modal bounds, backdrop, focus treatment, and mobile containment.
- `src/NetworkMap.tsx` owns deterministic radial/grouped layout, camera fit and limits, pan/zoom input, density collapse, clusters, and portrait selection semantics.
- `src/NetworkMap.css` owns the map canvas, subdued edges and group regions, circular portrait treatment, reciprocal label sizing, control placement, and mobile map adjustments.
- `src/NetworkProfile.tsx` owns preview and expanded profile composition, compatibility disclosures, sample insight/message starter, follow-up fields, and withdrawn-profile presentation.
- `src/NetworkProfile.css` owns profile typography, hierarchy, two-column-to-single-column adaptation, disclosure/form styling, and compact mobile identity layout.
- `src/networkModel.ts` is the frontend projection boundary. It applies visibility rules, derives shared interests and reciprocal skill matches, supplies authored sample projects/goals/scores, and labels sample, partial, unavailable, or withdrawn states.

Keep changes in the narrowest owner above. In particular, overlay sizing belongs to `NetworkPage.css`, map readability belongs to `NetworkMap.css`, and score/privacy semantics belong to `networkModel.ts` rather than presentation components.

## Demo and evidence boundaries

This is a React browser preview backed by repository demo data and the local mock-service action interface. It demonstrates frontend interaction, responsive layout, routing, privacy projection, and sample content presentation. It does not prove production authentication, durable social-graph persistence, live AI inference, backend matching, real event attendance, messaging delivery, Quest rendering, headset tracking, or device performance.

Saving, editing follow-up details, and removing a connection call the existing demo action interface. Copy message uses the browser clipboard. The visible score rubric and Sample AI insight are illustrative UI behavior; they are not a deployed recommendation service or validated ranking model.
