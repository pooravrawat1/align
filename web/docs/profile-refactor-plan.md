# Profile refactor plan

Status: implemented. The approved plan below records the design rationale; the completion notes describe the delivered behavior and verification.

Contact-sharing and footer details in the original plan below are superseded by the September 26 refinement in `../DESIGN.md`: one saved-connection access setting controls populated contact fields; individual contact toggles and Optional badges are removed; Other contact is a regular field; save actions appear only when needed; the page header opens the audience preview. Legacy contact flags are retained for serialized-data compatibility, not visibility decisions.

## Completion notes

- Delivered About, Focus, Contact, and Settings with direct URLs, keyboard tab navigation, Home-style panels, section-specific saves/discard, inline validation, and session-scoped draft recovery.
- Delivered contextual sharing controls, room/saved-connection draft previews, and shared editor/API validation limits without changing the underlying focus and matching field meanings.
- Subsequent explicit request: replaced the sample-photo label with a pencil upload control. JPG, PNG, and WebP files up to 10 MB are decoded, center-cropped, and resized to a 512px JPEG (maximum 256 KiB). Upload/removal participates in About drafts and saves; saved images reach profile consumers and JSON export. Images remain temporary demo-session data, not permanent media hosting.
- Verification: 13 Profile browser tests at desktop/phone sizes; 38 focused editor, profile-contract, API, contact-link, and collaborator tests; TypeScript/Vite build. Browser coverage includes delayed/failed saves, draft reload, sharing previews, keyboard navigation, narrow layouts, photo upload/removal/export, and invalid-image recovery. Separate spec review passed. Real-device/mobile-keyboard and production persistence are not proven by these checks.

Basis: `/Users/casey/align`, `main` at `775b45b049cc91af21b36ac429b67bddf949a04c`, plus the current uncommitted work. Inspected Profile and Home in the running desktop browser and traced their source, API validation, navigation, profile consumers, and existing tests. Mobile recommendations below are design requirements, not verified mobile findings.

## Decision

Rebuild Profile as a readable, task-oriented editor with four tabs: **About**, **Focus**, **Contact**, and **Settings**. Use Home's existing visual system. Put sharing choices beside their associated fields. Keep one profile data model and one draft owner, with explicit saves for the section being edited.

The person arriving here usually wants to change one thing before an event: their introduction, what they are working on, the expertise they seek, or a contact link. The first viewport must identify those destinations immediately. This is an Operate surface: the editing task leads.

## Findings that drive the design

- The current page combines identity, matching inputs, field sharing, contact details, room visibility, spatial explanations, preferences, export, data clearing, and sign-out in one scroll. There is no task navigation.
- Its labels and support text frequently use 11–12px type. The main sections are largely transparent against the canvas, unlike Home's clearly bounded charcoal panels and 20px panel headings.
- Labels such as “Make a little common ground” and “Who would make this event valuable for you?” take more interpretation than Interests, Skills, and Looking for.
- The save action appears after the entire form. The spatial preview cannot show many of the fields being edited and sits above completion scoring and repeated guidance.
- The draft lives inside `ProfileProduct`; App conditionally unmounts it on navigation away. The current save revision check protects edits made during a request, but does not provide draft restoration after leaving the page.
- `bio` is already the current-focus statement in onboarding and Home. `lookingFor` is sought expertise, not a free-form job title or relationship goal. Duplicating these fields would create competing sources of truth.
- Profile's input limits differ from the API: name 60/80, role 80/120, bio 240/500, location 80/120, topic count 6/20, topic length 40/80. Refactoring needs one consistent validation contract.
- Matching primarily uses normalized, explicit interests and offered/sought skills. Contact fields are not matching inputs. Visibility affects matching and downstream presentation.
- Profile styles are distributed through `styles.css`, `theme.css`, and `PersonalPages.css`. The replacement should establish a clear Profile owner while retaining shared tokens and components.

## Scope and closure inventory

Primary scope: Profile composition, wording, fields, navigation, form controls, preview, saving, draft lifetime, preferences, accessibility, responsiveness, and Profile-specific styles.

Connected scope: App routing/session lifecycle; Home's profile and focus links; onboarding field semantics; Event and Spatial profile presentation; Network and contact destinations; collaborator suggestions; API validation and match invalidation; JSON export; legacy settings route; demo fixtures; related tests and documentation.

Implementation must verify consumers before changing shared fields or deleting old code. Existing concurrent changes belong to their owners. Recheck the worktree before implementation: Network, Landing, and shared UI files changed during this planning pass.

This plan does not expand the product into production authentication, permanent storage, media hosting, live AI, new matching algorithms, or Quest implementation. These are product capabilities rather than prerequisites for a usable Profile editor. Any later additions must state their actual persistence and access behavior.

## Page composition

Keep the existing application sidebar and header. Match Home's content width and page gutters. Use a simple `Profile` title at 28px and a quiet `Preview profile` action aligned opposite it.

Below the title, show one horizontal navigation row: About / Focus / Contact / Settings. Use plain text with a clear active indicator, not four independent cards or a second full sidebar. Each section has a direct URL, supports browser Back/Forward, and preserves drafts. Dirty sections have a small indicator with an accessible “Unsaved changes” label.

The editor occupies roughly two-thirds of the desktop content width, with a bounded reading measure. About and Focus have a compact preview to the right. Contact and Settings do not retain an irrelevant spatial scene or expand their inputs to the entire wide canvas; they keep the same editor alignment. Panels size to their content.

Each editor panel follows Home's header, inset divider, content, and action rhythm. The active section's footer contains status, `Discard changes`, and the white `Save changes` button. A sticky footer is confined to the editor region, uses an opaque background, and must never cover fields, errors, or the mobile keyboard.

## Information architecture and fields

| Tab | Content | Field decisions |
| --- | --- | --- |
| About | Identity: portrait, name, headline, location | `name` → Name; `role` → Headline, with an example such as “Hardware engineer”; `location` → Location (optional). Only Name is required. Portrait now supports upload and removal via the subsequent explicit request; initials remain the fallback. |
| Focus | Current focus, interests, offered skills, sought skills | `bio` → Current focus; `interests` → Interests; `skills` → I can help with; `lookingFor` → I'm looking for help with. These are the same values used by Home, onboarding, and matching. |
| Contact | Ways a saved connection can reach the person | LinkedIn, Website, Email, plus collapsed Other contact when empty. Existing Other contact content opens visibly. Each channel includes its own sharing choice. |
| Settings | Discoverability, access for saved connections, appearance/sound, data/session actions | Keep room visibility and previous-connection access together. Place Reduce transparency and Match sounds in Preferences. Put Export, Clear event data, and Sign out in a separate Data and session panel. |

Avoid an additional Overview tab: About already gives a recognizable starting point, and an overview would add a click before editing. Avoid a wizard: returning users must edit any section independently.

Do not add separate About me and Project description fields in this refactor. Current focus is already established and useful. If people later need multiple projects, that warrants its own editing and persistence model.

Preserve existing data and API-compatible limits: name 80, headline 120, focus 500, location 120; up to 20 topics of 80 characters each; existing contact limits. Present concise examples and optional guidance toward a few specific topics. Do not truncate older values or impose lower limits only in the editor. Put the validation constants in a small shared contract consumed by the server and editors.

Topic controls should show selected values clearly, accept custom entries, and offer a short list of existing vocabulary. Use the same skill vocabulary for offered and sought expertise so the deterministic matcher can find actual overlaps. Enter/comma adds, Backspace works predictably, duplicate entries are recognized without losing typed text, and rejected/over-limit values receive an inline explanation. Keep a visible Add affordance for touch. Pending text is resolved before tab changes and saving.

## Sharing and preview

Put each editable sharing choice immediately beside or below its field: `Show on my profile` for focus fields, `Share with saved connections` for contact channels. Do not repeat the same editable toggle elsewhere. Hidden fields retain their values. Existing defaults remain intact, including private-by-default contact links.

Name and headline are identity fields; do not introduce individual visibility switches that the product cannot enforce. Explain identity exposure once. Audit Location against actual consumers before making a specific audience promise.

The existing `activeInEvent` value is stored on the profile, not in a per-event membership record. Use scope-accurate copy such as `Show me in rooms`, with the current room as context. Do not imply separate saved visibility choices for each event. Previous-connection access is a separate setting; turning it off must suppress shared contact even when an individual channel is enabled. Show the effective outcome beside affected controls.

The compact desktop preview defaults to the nearby card, where identity and interests have a visible effect. `Preview profile` opens a larger drawer with **In a room** and **Saved connection** views. It shows the current draft and says when changes have not been saved. The saved-connection view shows the full visible introduction and permitted contact links, making Focus and Contact edits inspectable.

Move Distant/Nearby/Matched exploration into an optional `Spatial preview` disclosure within that drawer. Preserve its educational function without making three distance states the main editing navigation. Any matched example must be clearly illustrative or derived from an actual eligible sample pair; one person's interest alone cannot prove that two people share it.

Use the same visibility/contact projection rules as the consuming surfaces. Share policy helpers where there is real duplication; do not force spatial cards and full profiles into one universal renderer with many mode flags.

Remove the completion percentage, generic writing-advice card, and repeated three-distance explanation from the editor. Replace genuinely necessary guidance with one short example at the relevant field. A person should not need to fill optional fields to make an arbitrary score reach 100%.

## Saving, drafts, and failures

Use explicit **section saves**. Saving Focus saves its fields and associated sharing choices; it does not commit unfinished contact edits. The active section displays `Unsaved changes`, `Saving…`, `Saved`, or an inline error. Do not use a page-wide success message when another section remains dirty.

One profile editor state owner tracks the saved baseline, draft, changed fields by section, and request revisions. Section components receive values and callbacks; they do not copy the profile into independent local state. Keep the existing App request queue authoritative for API actions.

Persist drafts within the browser session, keyed by session and profile identity. Restore them when returning to Profile or refreshing the tab; never restore one person's draft into another person's profile. Clear drafts on successful discard, sign-out, session expiry, and identity changes as appropriate. Saving one section removes only its acknowledged changes. A local draft is not a saved or published profile. Handle unavailable browser storage with an in-memory draft and an honest indication of the restoration limit.

Submit only the changed fields in the active section, including only the visibility keys it owns. API validation remains atomic. Save completion merges acknowledged fields into the baseline without overwriting later keystrokes or another section's edits. The existing edit-during-save protection must survive the extraction.

Validate within the active section, show field errors next to their inputs, and focus the first invalid field on submission. A hidden tab's invalid draft must not block saving the current valid section. Server failures retain the draft and put retry feedback beside Save. Do not rely exclusively on the App-level error banner.

Settings distinguishes saveable profile visibility from immediate browser preferences. Put `Applies immediately on this browser` in the Preferences panel; its controls have no second save step. Data/session actions remain explicit actions with their existing backend scope. Do not alter clear-event-data behavior as an incidental layout change.

Do not add navigation confirmation dialogs for routine tab changes. Draft preservation handles the common case. `Discard changes` affects only the active section and is labeled accordingly.

## Visual and responsive specification

- Reuse Home's neutral canvas, opaque charcoal panels, Geist headings, Inter controls, white primary action, 14px panel corners, and shared header/divider tokens. Glass remains confined to the spatial preview over imagery.
- Page title 28px; panel titles 20px; field labels 14px medium; input content 15–16px; helper text 13–14px. Reserve 12px for secondary metadata. Test actual contrast and focus visibility.
- Use 24px panel insets and module gaps; consistent field rhythm; restrained borders. Labels remain outside inputs. Name/headline can share a desktop row if both have adequate width; otherwise stack.
- No decorative hero, completion dashboard, motion-heavy tab transition, or tall explanatory sidebar. Transitions are brief state feedback and respect reduced motion.
- At widths that cannot support a comfortable form plus preview, remove the preview rail and retain the Preview action. Do not squeeze the editor into a narrow strip.
- On phones, show four short tabs without tiny text. Where zoom or a narrow viewport requires overflow, keep the active tab visible and provide a discoverable horizontal scroll region. Tabs support arrows, Home/End, selection, and labeled panels.
- Stack fields, keep controls at least 44px tall, use 16px mobile input text, and keep document scrolling natural. The preview drawer becomes a full-width sheet with focus management, Escape/close, and focus restoration.
- At 200% zoom and with long names, links, and many tags, content wraps without page-level horizontal overflow. Save/status content must remain visible and usable without overlapping the editor.

## Implementation sequence

1. **Establish the profile contract and boundary.** Recheck concurrent edits. Inventory profile-only code and CSS references, consumers, validation, and tests. Extract a dedicated Profile page and a single editor state owner without changing Network's implementation. Establish the shared field validation constants. Preserve current values, visibility defaults, API match invalidation, and the revision safeguard.
2. **Build About and the navigation shell as one complete slice.** Add four URL-addressable tabs, Home-style panels, section save/status, discard, draft restoration, and accessible tab behavior. Verify About edit → save → Home update, and edit → navigate away → return with draft intact.
3. **Build Focus and Contact.** Move the real fields, improve topic entry, colocate sharing, and wire the legacy Home `profile?section=focus` link to the new Focus tab and correct field. Catalyst onboarding copy/validation uses the same data semantics. Verify matching/contact consumers and invalid-field recovery.
4. **Build the preview and Settings.** Add the shared audience projections, draft preview, optional spatial states, scope-accurate visibility copy, separated browser preferences, and data/session actions. Preserve `#/settings` as a Settings-tab alias. Remove the old completion/guidance content after replacement coverage exists.
5. **Finish responsive behavior and close regressions.** Test realistic desktop/phone sizes, keyboard/zoom behavior, long/empty content, API failures, storage limitations, and edits during saves. Inspect the exact Home → Focus → save → Home and Contact → sharing → Network tasks. Consolidate obsolete Profile CSS only after confirming no remaining references. Update DESIGN and implementation docs to reflect the shipped result.

Use a dedicated `ProfilePage.tsx` and `ProfilePage.css`, plus a small editor hook/model and components split by actual responsibility. Avoid a generic form builder, a new state library, and a broad Network refactor. App owns session/request lifecycle; the editor owns unsaved profile state; the API owns saved profiles and match invalidation.

## Acceptance and proof

- From Home, Edit focus lands directly in Focus with the right field focused; saving updates Home and survives a normal reload while the demo service remains running.
- Name, focus, and contact each have one obvious editing destination. The first viewport exposes section navigation and a preview action; the active section's save action stays reachable.
- Changing tabs, visiting Home, and returning do not silently discard unsaved edits. Discard and successful saves affect only their stated sections.
- An invalid contact draft does not prevent saving About. A delayed save response cannot erase newer text or mark it saved. An API failure retains edits and offers a usable retry.
- Hidden fields are absent from the relevant audience preview and downstream presentation. Contact is private by default; previous-connection withdrawal takes precedence. Matching continues to exclude hidden matching inputs.
- Existing exports include the saved profile/contact data, not accidental unsaved drafts. Event clearing retains its existing profile-preservation contract. Browser preferences apply as described.
- Desktop, phone, keyboard-only, and zoomed interaction checks cover tab navigation, Save, errors, topic entry, drawer focus, and long content.
- Focused tests cover editor state, API field/visibility contracts, and browser tasks. Existing Home/contact/matching regressions run after connected changes. Run the TypeScript/Vite build once the substantive integration is complete.
- A separate adversarial review at implementation completion checks ownership, stale drafts, identity separation, partial saves, preview truth, field migration, and shared-style regressions.

The original planning evidence was desktop inspection and source review. Implementation verification is recorded in Completion notes above. Production persistence, cross-account enforcement, multi-device behavior, and Quest behavior remain separate evidence classes.

## Deliberate follow-ups

Permanent photo storage/media hosting remains a separate capability. The explicitly requested demo-session upload, validation, replacement/removal, and export flow is implemented.

GitHub and other structured contact channels can be added as a coherent model/API/visibility/renderer/export slice after the editor is established. Preserve existing free-text Other contact immediately. Do not quietly infer links or import data from a LinkedIn URL.
