# Network frontend surface

This document records the implemented Network experience in the browser preview. It is a surface-specific companion to `PRODUCT.md`, not a replacement for the project design system.

## Product and visual contract

Network belongs to the incumbent Home and Event world: neutral charcoal layers (`#101113`, `#191A1D`, and nearby raised surfaces), white and muted-gray type, Geist for large identity moments, and Inter for controls and reading. Jade is reserved for positive common ground, readiness, and live state; compatibility is contextual guidance rather than a public rank.

All structural hairlines on Network use the shared `--divider-subtle` token: navigation, section headers, People rows, Discover-card sections, the map footer, and full-profile sections. Control outlines and selected/focus states may remain stronger because they communicate interaction rather than structure.

The map is deliberately quiet. People appear as circular portraits with names and roles, joined by restrained relationship lines. Do not add portrait rings, orbit decoration, or a visible grid. Group containers may provide faint spatial organization for Event and Shared interests, but they stay subordinate to people. Dense maps collapse into labeled clusters until the user reveals a group.

## Main behavior

- **Destinations:** Your network shows saved connections; Discover shows eligible unsaved sample attendees. Search spans visible profile fields. Filters cover event, interest, and follow-up state where applicable.
- **Views:** Saved connections land in People and can switch to the secondary Map view. The People/Map segmented control, sort menu, grouping menu, filter selects, filter trigger, and follow-up filter use the same compact pill geometry. The map supports pointer panning, wheel zoom, explicit zoom controls, fit-to-network, and grouping by Connections, Event, or Shared interests. Portrait labels remain readable at different zoom levels and truncate within their node instead of overflowing on mobile.
- **People:** Map and People share the same **Your people** section title, 20px/500 card-title role, and 12px metadata subtitle; Discover uses the same hierarchy with **Discover people**. The list uses Home's compact identity hierarchy inside a content-height card: 52px portraits (44px on mobile), 15px/600 names, 12px roles, and 13px shared-common-ground copy. Row content stays visually stable on hover; a muted right arrow brightens and moves four pixels on hover or keyboard focus to communicate the profile action. Compatibility uses the same number, `/100`, and label stack as Discover; only scores of 80 or higher receive the green high-compatibility color. Do not restore column labels, redundant event/date metadata, or the map-only footer to this view.
- **Selection:** Selecting a map portrait, person row, Discover card, or Home connection updates the hash route with `person` and opens the full profile directly. There is no intermediate preview state or secondary route parameter.
- **Full profile:** The profile opens as a centered modal, at most 920px wide and 80dvh tall, over a dimmed and blurred backdrop. The default reading path is identity, project summary, common ground, reciprocal skills, and a compact Compatibility card. Bio, goals, and the complete skills profile live under **More about**; message, notes, reminder, and status live under **Your follow-up**. Both disclosures start closed so secondary detail does not compete with the connection story. On mobile the modal remains inset by 12px on each side and uses contained scrolling when needed.
- **Navigation and focus:** Full profiles use **Back to network** and a close control, both of which remove the selected person and return to the originating Network destination in one step. Initial focus moves to the profile name without adding a non-interactive focus ring. Escape and backdrop clicks close the modal. Closing restores focus to the initiating control. Selecting or closing a person preserves page scroll; the app resets scroll only when the route page changes. Visible keyboard focus, reduced-motion handling, and reduced-transparency handling are part of the surface contract.
- **Privacy:** The frontend projects only fields allowed by profile visibility. Withdrawn people expose a private-state message instead of their shared details. Contact destinations appear only for saved, non-withdrawn connections whose contact fields are explicitly visible.

## Compatibility presentation

Compatibility is authored frontend data derived from visible profile fields. The 100-point rubric is:

| Category | Points |
| --- | ---: |
| Reciprocal skill fit | 30 |
| Networking goals | 25 |
| Project synergy | 15 |
| Mutual value | 15 |
| Shared interests | 10 |
| Conversation potential | 5 |

Known unchanged seeded profiles may receive authored category points and a total score. Other profiles show partial or unavailable states instead of fabricating a score. **AI insight** is optional disclosure content that offers an authored suggestion and message starter from visible fields. The interface uses the concise labels **Compatibility** and **AI insight**; it does not repeat sample-profile badges, demo qualifiers, or backend disclaimers around the content.

## Source ownership

- `src/NetworkPage.tsx` owns destinations, search/filter/sort state, map/list switching, selection history, save-connection admission, and composition of the browser, map, Discover cards, compact People rows, and full-profile modal.
- `src/NetworkPage.css` owns the Network shell, incumbent charcoal styling, Home-aligned People typography and density, responsive card/list layouts, full-profile modal bounds, backdrop, focus treatment, and mobile containment.
- `src/NetworkMap.tsx` owns deterministic radial/grouped layout, camera fit and limits, pan/zoom input, density collapse, clusters, and portrait selection semantics.
- `src/NetworkMap.css` owns the map canvas, subdued edges and group regions, circular portrait treatment, reciprocal label sizing, control placement, and mobile map adjustments.
- `src/NetworkProfile.tsx` owns full-profile composition, Compatibility disclosures, AI insight/message starter, follow-up fields, and withdrawn-profile presentation.
- `src/NetworkProfile.css` owns profile typography, hierarchy, two-column-to-single-column adaptation, disclosure/form styling, and compact mobile identity layout.
- `src/networkModel.ts` is the frontend projection boundary. It applies visibility rules, derives shared interests and reciprocal skill matches, supplies authored projects/goals/scores for seeded profiles, and represents partial, unavailable, or withdrawn states.

Keep changes in the narrowest owner above. In particular, overlay sizing belongs to `NetworkPage.css`, map readability belongs to `NetworkMap.css`, and score/privacy semantics belong to `networkModel.ts` rather than presentation components.

## Demo and evidence boundaries

This is a React browser preview backed by repository data and the local mock-service action interface. It demonstrates frontend interaction, responsive layout, routing, privacy projection, and authored content presentation. It does not prove production authentication, durable social-graph persistence, live AI inference, backend matching, real event attendance, messaging delivery, Quest rendering, headset tracking, or device performance. That boundary belongs in product and engineering documentation rather than repeated badges or disclaimer copy inside each profile.

Saving, editing follow-up details, and removing a connection call the existing local action interface. Copy message uses the browser clipboard. Compatibility and AI insight are frontend-authored presentation, not a deployed recommendation service, real matching backend, live AI system, or validated ranking model.

## Regression evidence

`tests/browser/network.spec.mjs` compares the People row's computed name, role, and supporting-copy sizes directly with Home at 1440px and 390px. The same browser coverage checks that People contains no sample/demo labels, has no horizontal overflow, and opens the centered full profile directly at both desktop and mobile widths.
