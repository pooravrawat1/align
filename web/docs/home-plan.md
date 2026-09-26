**Catalyst Home — product and design plan**

Status: implemented in the local web app. Home uses the existing profile data, a visibility-aware sample people preview, and event-specific routes. Verified with focused helper tests and desktop/mobile DOM interaction tests; no screenshots taken.

Home connects personal intent, participation in an event, and relationship memory. Its three questions are: where can I participate, who have I met, and what am I trying to move forward? Network owns deeper relationship work, including contact details, notes, and the existing optional message composer.

**First release composition**

1. Greeting, with no secondary explanatory paragraph.
2. Compact photographic event hero spanning the content width.
3. Two-column working area: Recent connections at roughly two-thirds width, Your focus at roughly one-third.
4. A quieter Other events section with compact event previews.

Keep the existing sidebar, canvas palette, real conference photograph, glass profile material, and typography families. Avoid another broad visual redesign. The stronger hierarchy comes from composition, spacing, and useful content.

**Event hero: participation**

- Reduce the desktop hero from its current 360px minimum toward 280–300px, allowing the working area to appear sooner. Use content-driven height on phones.
- Keep the event title, date/location, Enter room, and Event details. Keep the compact glass profile card on the right, using its existing 250px maximum width.
- Use the current joined room when the session has a valid event code. Otherwise explicitly present an available demo event; do not imply the person has joined it.
- Retain the real photograph and neutral dimming. No green wash, generated imagery, fabricated attendance, or live indicator.
- Consolidate demo labeling into one quiet event-context label rather than repeating it around the hero.
- Move general event browsing to Other events, leaving the greeting area calm.

**Recent connections: relationship memory**

- Restore the left column and show up to three saved people, ordered by saved date.
- Preserve 52px portraits, 15px semibold names, 12px roles, and one short line of context.
- Prefer an actual saved conversation reason; otherwise use explicit shared profile information. Do not invent conversation memories. Keep private notes in Network for this release.
- Clicking the person opens expanded Network details. Shared LinkedIn, website, and email links remain separate, accessible actions. Missing or private contact fields produce no placeholder icons.
- Keep flat rows. Hover is a faint rounded wash extending into the panel inset, with comfortable space around the portrait. No selected state, appearing label, motion, or trailing arrow.
- Preserve the 20px heading and header hairline. Show View network as a quiet text action. Let the panel size to its content.
- With no saved people, use a compact invitation and Enter room action, rather than a tall empty illustration or sample connections belonging to another profile.

**Your focus: purpose**

- Place this card to the right of Recent connections. Use the same opaque panel, heading size, padding, and header divider.
- For the first release, use the person's entered bio as their focus statement and their lookingFor fields as the expertise they are seeking. Do not introduce a second copy of editable profile state.
- Show the statement as 16px primary text with comfortable line height. Then a quiet Looking for label and up to two rounded topic pills; additional topics expand in place.
- Include an accessible Edit focus action that opens the relevant Profile fields. Editing saves through the existing profile API. Prefer a small pencil action over another diagonal arrow.
- The primary action is Find collaborators. This must open a real people preview, not redirect ambiguously to Home or saved Network connections.
- The people preview is a small drawer using the current event's eligible demo participants, their visible skills and interests, and the existing explicit matching rules. Explain the relevant overlap in plain language; do not introduce a percentage score or claim AI inference. Inspect a person before entering the room; do not save them automatically.
- If there is no supported overlap, show the available participants without claiming a recommendation. If the person has not entered a focus, offer Set your focus. Do not display a readiness score or progress checklist.
- Avoid an additional recommendation card nested inside Your focus in the first release. The focus statement and the action are enough.

**Other events: a reason to return**

- Use one full-width shared panel: section heading and All events in the standard card header, a hairline, then flat event rows. Avoid nested event card borders or fills.
- Reuse available event data for at most two compact horizontal previews: small real-photo thumbnail, title, date/location, and a short description. Keep the current event in the hero and avoid duplicating it below.
- Render only available records. With one other event, show one preview; do not manufacture a second tile for symmetry.
- Open the specific event's existing details. Preserve the illustrative/demo designation. Do not label an event upcoming based on a date string without a year or timezone.
- Reuse verified photographic assets or a neutral text-led preview. Do not use the rejected AI room imagery for this new Home section.

**Visual system**

- Character: the current restrained Catalyst shell, with the photographic warmth and glass reserved for the event. Product panels remain neutral charcoal.
- Typography: Geist for page and section headings; Inter for people, descriptions, metadata, and controls. Greeting about 28px, section titles 20px/500, focus statement 16px, names 15px/600, supporting copy 13–14px, metadata 12px.
- Panels: shared 14px radius, 24px content inset, faint 1px outline. Controls: shared 10px radius and 44px primary action height. Tags: fully rounded. Preserve current hero/profile geometry.
- Headers: existing compact rhythm, 8px above the hairline and 16px before content. Dividers align to content edges; avoid extra lines around every paragraph.
- Layout: about 24px between modules, one consistent left edge, independent panel heights. Do not stretch the shorter panel just to match its neighbor.
- Actions: Enter room is the main page action. Find collaborators is the focused card action, using the same white button system. Navigation elsewhere is text with hover/focus underlines. Icons identify actions or destinations rather than decorate every link.
- Interaction: quick background/color transitions, visible keyboard focus, no lift, scale, sliding labels, or automatic carousels. Respect reduced motion.

**Responsive behavior**

On narrow layouts, stack the hero, Your focus, Recent connections, and Other events. Keep focus above the longer list so the purpose and action remain easy to find. Use natural content height, wrap long names and topics, retain reachable contact links, and avoid horizontal scrolling. The collaborator drawer becomes a full-width sheet with an accessible heading, focus management, Escape/back close behavior, and restored focus to its trigger.

**Build order and proof**

1. Restore composition and compact the hero, reusing current data and routes. Establish desktop and mobile hierarchy before adding the collaborator interaction.
2. Implement Your focus using the existing profile owner and a targeted edit destination. Verify empty, long, and edited content.
3. Connect Find collaborators to the people preview and existing visibility/match rules. Verify hidden fields, no-overlap cases, inspection, and room entry without implicit saving.
4. Add compact event discovery with event-specific destinations and honest demo labeling.
5. Run one bounded polish pass for hover, dividers, type, wrapping, and focus. Run source/build checks and targeted DOM/interaction tests. Do not take screenshots unless Casey changes that instruction.

Acceptance: Home exposes event entry, saved people, and personal intent; the right card is useful; navigation lands on the intended person/event; no fabricated links, memories, rankings, or live claims appear; privacy choices survive the new consumers; empty states remain compact; the Network composer remains available in connection details.

**Later product work**

- Add explicit projects only when people need multiple projects or separate collaboration goals. That requires a project owner, editing lifecycle, and persistence, rather than extracting titles from biographies.
- Add communities when there are real memberships and recurring events to return to.
- Add before/during/after Home emphasis when event records include reliable timestamps and attendance state. The current date/time strings and demo phase controls do not establish that automatically.
- Add reminders and conversational memory only from actions and notes a person actually saved. Avoid creating tasks merely because someone saved a connection.

The local contact-field API restart remains a separate pending step from the previous implementation; this planning work does not authorize resetting current demo sessions.
