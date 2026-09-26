---
name: Catalyst Spatial Salon
description: A compact spatial networking app with Linear-like discipline and restrained salon depth.
colors:
  graphite-background: "#101113"
  deep-canvas: "#050606"
  surface: "#191A1D"
  surface-subtle: "#202125"
  raised: "#222428"
  hover: "#27282E"
  selected: "#2B2D32"
  text: "#F2F3F5"
  muted: "#A8ABB2"
  quiet: "#93979F"
  hairline: "#FFFFFF14"
  control-subtle: "#FFFFFF06"
  control-border: "#FFFFFF20"
  chip-surface: "#101113"
  chip-border: "#FFFFFF26"
  jade: "#69E6A6"
  jade-ink: "#103622"
  spatial-glass-highlight: "#72756B72"
  spatial-glass-shadow: "#343B3499"
typography:
  display:
    fontFamily: "Geist Variable, Inter Variable, sans-serif"
    fontSize: "clamp(34px, 4.4vw, 53px)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  page-title:
    fontFamily: "Geist Variable, Inter Variable, sans-serif"
    fontSize: "36px"
    fontWeight: 500
    lineHeight: 1.14
    letterSpacing: "-0.035em"
  dialog-title:
    fontFamily: "Geist Variable, Inter Variable, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  card-title:
    fontFamily: "Geist Variable, Inter Variable, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  section-title:
    fontFamily: "Geist Variable, Inter Variable, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  supporting:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  metadata:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "0.09em"
rounded:
  control: "10px"
  panel: "14px"
  cinematic: "16px"
  spatial: "22px"
  feature: "24px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "24px"
  page: "40px"
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.graphite-background}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.control-subtle}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "24px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "44px"
  tag:
    backgroundColor: "{colors.chip-surface}"
    textColor: "#D7D9DE"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
---

# Design System: Catalyst Spatial Salon

## Overview

**Creative North Star: "Spatial Salon"**

Catalyst combines a neutral, Linear-like application shell with the intimacy of a modern salon. The interface stays compact, quiet, and operational until a room image or spatial scene earns atmosphere. The approved hybrid preserves the original v1 proportions and nested containers while using the sharper v2 typography, login, header, preview, and interaction language.

Reference fidelity is additive, not a license to redesign: retain the old Event two-column photo cards and compact Home, Network, and Profile composition; use the final v2 type and shell; reveal Before / During / After only after an event is opened. Achromatic frosted glass belongs only over imagery or inside the spatial experience.

**Key Characteristics:**

- Neutral charcoal application layers with disciplined jade state cues.
- Compact, readable 13–14px interface text and 11–12px metadata.
- Opaque nested work surfaces; glass only where scene depth justifies it.
- Photographic event rooms and spatial panels provide warmth without tinting the shell green.
- The browser preview keeps the room scene visible while person details remain readable in a focused panel.

## Colors

### Demo entry

The entry screen uses the supplied split-layout reference with Catalyst's shared geometry: 10px controls and 14px panels. The outer frame uses the same `product-panel` class as Home and Event. The artwork is flush with the frame, with square right corners at the column seam. A deep emerald gradient with softly diffused teal light and three journey steps sits on the left. The first step is white with a dark-green number circle; steps two and three have a subtle white translucent fill without an outline. This artwork is a scoped exception, not a global accent.

The right side is a three-step demo-entry form, not real account creation: “Create your profile,” “What are you working on?”, then “Who would you love to meet?” Use left-aligned 36px headings (30px on small phones), left-aligned 14px supporting copy, shared raised charcoal inputs, and a white CTA. Center the form group within the desktop panel when it fits; longer content starts at the top and scrolls inside that panel. Headings, subtitles, the selector, labels, and inputs share a left edge; the overall group remains vertically centered. Helper text uses smaller 12px italic type. Field groups use 16px spacing, with helpers kept 8px from their own field and 24px between the header and form. The left-aligned Alex/Maya pill appears only on step one; each person has a separate prefilled draft. Step two collects a short bio, offered skills, and an optional LinkedIn link. Step three collects interests and sought expertise, with The Builders Room selected. All three numbered journey cards are full-card buttons for direct forward/back navigation; the current step is white and the others frosted. Navigation and refresh preserve drafts, including unfinished tags. Only “Go to Home” validates the complete draft, saves the confirmed profile, and joins DEMO, then opens Home. Invalid skipped fields return to the corresponding step before any API writes. Failures stay inline with the draft intact; retries reuse the current person's session and do not rejoin an already joined room. Successful completion clears the entry draft. LinkedIn is a saved link, not an import; sharing remains controlled by Profile visibility. Résumé parsing and live two-device synchronization are separate follow-ups, with no dead upload or OAuth controls. The landing page's Step inside action always opens entry, including for returning visitors. The upper-right X returns to the landing page. On mobile the artwork becomes a compact, edge-to-edge header above the form.

The website palette is neutral charcoal, white, and cool gray, including branding, selected profiles, navigation, and focus states. Jade signals connections and live presence; it is not a general accent. Spatial cards restore the original v1 material exactly, retaining its subtle environmental tint and brighter diffusion over room imagery.

The entry preset selector uses the same raised charcoal surface as the fields, with a white selected pill. One neutral hairline separates the selector from the identity fields. Scrollbar space is symmetric so the form remains horizontally centered.

The onboarding project question writes the existing profile `bio`, which Home presents as “Your focus.” The expertise sought in step three writes `lookingFor`, which supplies the card's “Looking for” pills and collaborator matching. Keep these shared fields authoritative rather than adding a separate onboarding project record.

Keep the entry copy compact: “Create your profile” fits a single desktop line. Every step uses the app's established panel-heading hierarchy: a left-aligned title, a concise subtitle, 16px of space, a neutral 1px hairline, then 24px before the form content. Step two uses “Share what you're building and what you bring.” and omits the LinkedIn helper. The demo-mode footer is removed from all steps. LinkedIn remains optional. Form top padding is 48px, with scrolling retained for expanded content. Interests and sought expertise use the same outlined neutral pill treatment as Home; Enter or comma adds a typed item and × removes it. Skills retain their existing chip styling.

### Primary

- **State Jade** (`#69E6A6`): readiness, live state, active navigation details, positive matching, focus, and completion.

### Neutral

- **Deep Canvas** (`#050606`): signed-in page canvas, header, and outer login-page background.
- **Graphite Background** (`#101113`): the surrounding public-page backdrop.
- **Charcoal Surface** (`#191A1D`): cards, forms, and primary work surfaces.
- **Raised Charcoal** (`#222428`): selected segments and nested controls.
- **Primary Text** (`#F2F3F5`): headings and high-priority interface copy.
- **Muted Gray** (`#A8ABB2`) and **Quiet Gray** (`#93979F`): support text and metadata.
- **Hairline White** (`#FFFFFF14`): low-contrast borders and dividers.
- **Spatial Sage** (`#B8E4C1`) and **Sage Text** (`#E8EDDF`): spatial overlays and matched-room material only.

**The State Color Rule.** Jade communicates readiness, live state, a compatible reason to meet, selection, or completion. It is never decorative and never implies public ranking.

**Canonical accent tokens.** `--jade` (`#69E6A6`) is the color primitive. Product UI consumes it through `--accent`, `--accent-ink`, `--accent-surface`, `--accent-border`, `--accent-border-strong`, `--accent-glow`, and `--accent-hover`. Components must not define local jade or sage approximations for semantic states. White remains the primary-action color. Photographic atmosphere, entry artwork, and spatial glass keep their separate material palettes.

**The Neutral Base Rule.** Opaque backgrounds remain graphite or neutral charcoal; do not turn the application shell olive or dark green.

**Shared entry/dashboard hierarchy.** Both use a near-black outer canvas with the same charcoal panel background, hairline border, and rounded geometry. Login reuses the regular website surface classes, not Home's special image-overlay glass. Form inputs and the selected demo-person segment use the shared raised surface token. The white CTA and current journey step stay white. Translucency is limited to the artwork's inactive journey steps; the form stays opaque and neutral. On desktop the centered login frame keeps the same viewport-bounded height across all three steps. Only the right-hand form scrolls; the left artwork, journey cards, and close control stay in place. Each step opens at the top of its form. Mobile keeps the stacked layout with natural page scrolling. The separate Back control is removed in favor of the numbered journey cards. Spatial glass recipes and green match states are unchanged.

## Typography

### Entry hints

Input and textarea placeholders share one global typography role in `theme.css`: `--text-placeholder` (neutral secondary text), `--weight-placeholder` (regular), upright, full opacity, and inherited control font family and size. Do not add per-page placeholder overrides or shrink hints relative to entered text. Use short action phrases for tag entry, such as “Add interest…” and “Add a need…”. Labels remain visible; placeholder text is not a replacement for a label. Helper text and entered values are separate roles.

**Display Font:** Geist Variable with Inter Variable fallback  
**Body Font:** Inter Variable with system sans-serif fallback

**Character:** Geist gives major moments a clean, contemporary edge; Inter keeps dense product work direct and readable.

### Hierarchy

- **Display:** landing, onboarding, cinematic event titles, and spatial setup use the responsive display role, capped at 53px with 1.08–1.16 line-height.
- **Page title:** Home, event browse/detail, Network, Profile, and system reference use `--type-page-title`: 36px desktop and 30px at widths up to 760px, weight 500, line-height 1.14, tracking -0.035em.
- **Dialog title:** focused person and modal identity titles use `--type-dialog-title` at 28px/500.
- **Card heading:** panel and card names use `--type-card-title` at 20px/500.
- **Section heading:** compact content divisions use `--type-section-title` at 16px/500.
- **Body:** descriptions, form labels, and reading copy use 14px/400 with 1.5–1.65 line-height.
- **Supporting and controls:** context and actions use 13px; person names may use 14–15px/600 according to density.
- **Metadata:** dates, locations, topic pills, and quiet secondary facts use 12px. The 11px label role is reserved for short status labels, codes, and segmented controls.

**The Compact, Not Tiny Rule.** Core support copy and controls remain 13–14px; 11–12px is limited to metadata and status labels.

### Shared implementation

- `src/theme.css` owns semantic surface, text, typography, spacing, border, radius, and motion tokens. Page CSS consumes the semantic role rather than repeating a hex value or inventing a nearby size.
- `src/ui.tsx` owns Button, TextAction, Chip, PageHeader, PanelHeader, Disclosure, Avatar, Toggle, and empty-state primitives. Repeated page structures compose these components; surface-specific CSS may arrange them without redefining their hierarchy.
- `#/system` is the visual reference for type roles, the surface ladder, and shared component states. Review a system change there before migrating it to product surfaces.

## Layout

Desktop uses a 230px sidebar, an 80px header, and a content canvas capped near 1420–1450px with approximately 40px page padding. Layouts use restrained nested grids rather than dashboard metric blocks.

- **Home:** a 290px photographic launch hero above Recent connections and Your focus in two columns, with quiet Other events previews below. Use natural hero height on phones.
- **Event browse:** room-code entry followed by the original two-column photographic event cards. Before / During / After controls are absent until an event is opened.
- **Event detail:** compact title and phase control; Before uses a `1.45fr / 0.65fr` overview and readiness split; During keeps a 340px scene with its setup card fully visible; After uses a restrained recap plus two-column detail panels.
- **Network and Profile:** preserve compact v1 nested-panel proportions while using the v2 type, preview, and control treatments.
- **Spatial:** the scene leads. The browser path enters through the event code or existing session, opens the room, then opens a person in a common-ground panel. The person panel uses an opaque charcoal reading body with a fixed save footer; its body scrolls independently when profile details are long.

At roughly 1050–1100px, major grids collapse or reduce columns. At 800–820px, the shell and event compositions stack. At 620px and below, page padding tightens and cinematic content becomes vertical; 44px touch targets remain intact.

## Elevation & Depth

The app shell is flat and tonal by default. Opaque surfaces separate through charcoal steps and hairline borders. Depth appears over photography and inside spatial mode through blur, subtle inset highlights, and low ambient shadows.

- **Cinematic ambient:** `0 22px 70px #070A071F` for image-led event frames.
- **Spatial panel:** `0 18px 50px rgb(0 0 0 / 30%)` with inset light and dark edges.
- **Spatial glass:** restore v1's `linear-gradient(135deg, #72756b72, #343b3499)`, `blur(30px) saturate(115%)`, `#ffffff38` border, and `inset 0 1px 0 #ffffff30, inset 1px 0 0 #ffffff10, 0 14px 38px #080e0b26` shadow. Landing identities, Profile preview, spatial identities, drawers, dock, and recovery panels share this recipe. Do not desaturate or darken the backdrop.
- **Spatial entry:** the browser entry card is a compact opaque charcoal surface with an inset glasses icon, event-code field when needed, and a white enter action. It does not introduce setup steps, calibration, or readiness states.
- **Matched glass:** when a reason to meet resolves, the whole card shifts to a shared green frosted material: `linear-gradient(120deg, #89a78caa, #436b50c7)`, a bright `#c8f7cb99` edge, and `inset 0 1px 0 #e1fce367, 0 8px 36px #203c3440` shadow. The jade label and explanation confirm why it changed. The neutral card keeps the silver frost edge; saved state does not add another outline.
- **Card state edges:** neutral and saved cards inherit only the subtle silver material edge; saved state never adds another outline. Only `Reason to meet` cards use a jade outline and jade state label.

**The Earned Glass Rule.** Use glass only over imagery, within the room stage, or for a short spatial overlay. Forms and long reading surfaces stay opaque.

## Shapes

Primary and secondary CTAs use the shared pill silhouette. Utility controls use 7–12px radii, ordinary panels 14px, cinematic frames 16–18px, and spatial feature panels 22–27px. Tags, statuses, and small segmented states may also use pills. Borders are one-pixel translucent hairlines; avatars and completion marks may be circular.

## Components

### Buttons

- Minimum height is 44px with 13–14px medium-weight text.
- Primary actions are warm-white on graphite; jade buttons are reserved for stateful spatial actions.
- Primary and secondary buttons are pill-shaped. Hover and keyboard focus use the Creo-inspired interaction: the surface inverts, a 1px reflective inner stroke resolves, and a separate 2px warm-white capsule appears 6px outside the control. Press compresses to 97%; reduced motion keeps the color and stroke feedback without movement.
- Quiet secondary CTAs use the shared text-action treatment instead of a filled button. Hover and keyboard focus brighten the label, raise its weight from 500 to 650, draw a 1px underline, and move a directional icon by 2px. Filters, tabs, icon buttons, expanders, and destructive controls keep their own interaction patterns.

### Cards / Containers

- Product panels use `#191A1D`, a 14px radius, a hairline border, and 20–24px padding.
- Event browse retains two large photo cards with 22–24px titles and 12–13px supporting copy.
- Nested Network/Profile surfaces remain compact and clearly subordinate to the page shell.

Opaque nested content cards share `--surface-nested` (#222428), `--border-nested` (#ffffff22), and `--shadow-nested` (a faint inset top highlight plus a soft downward shadow). This material is used by shared disclosures, Network Discover and connection-detail cards, Home's collaborator-reason callout, the Event room-code panel, and Profile preview sections. The design-system page demonstrates it. Keep outer panels flat, input/row/control treatments distinct, and image-backed spatial glass unchanged; do not apply blur to opaque nested cards.

### Card headers and dividers

Home's Recent connections and Your focus use the shared `.card-header` pattern: header, inset hairline, content, and an optional action. Standard headers reserve a 32px action row, followed by 8px of space (`--card-header-gap`), a 1px divider, and 16px before the content. The `.card-header--compact` variant uses the label's natural line height without the action-row minimum or a bottom margin; its parent supplies the 16px content gap.

- `--divider-subtle` follows `--line` for opaque panels; `--divider-on-glass` is white at approximately 17% opacity for photo-backed glass.
- The Home profile badge is capped at 250px, with 14px padding, an 18px radius, and a 48px portrait. It uses `--glass-milky` over a lighter neutral base and `--glass-stroke` for a fine glass edge. Name and role sit beside a circular pencil affordance; the whole badge opens Profile. Omit the status header and divider, and show Complete profile only when incomplete. Opaque page and connection panels retain their existing material.
- Shared type roles: card titles 20px/500, person names 14px/600, supporting text 13px/400, and metadata 12px/400. Saved-person names use 15px/600 with 52px portraits. Home headings use Geist; names and supporting text use Inter.
- Home connects event participation, relationship memory, and personal intent. Recent connections sits beside Your focus, which reads the saved bio and looking-for topics directly. Focus comes first in the mobile reading order. Other events uses one full-width panel with the shared header hairline and flat, softly highlighted event rows. It shows up to two other event records without inventing dates or attendance; specific event details open without joining. There is no Home message composer. Rows show name, role, and concise shared context, without follow-up status or repeated event names. One invitation appears when there are no saved people.
- Your focus uses a 16px statement, up to two rounded topic pills with inline expansion, targeted Profile editing, and a white Find collaborators action. Its modal preview uses explicit visible skills/interests, excludes inactive participants, and restores keyboard focus between list/detail and on close. Opening a preview never saves a person or joins a room.
- Rows link directly to expanded Network connection details. A faint rounded hover extends 12px into the panel's existing inset, preserving text alignment and giving portraits comfortable space. There is no persistent selection, appearing action label, or repeated arrow. Keyboard focus remains visible.
- Optional LinkedIn, website, and email icons sit alongside saved people only when the person explicitly shares each field and permits access for previous connections. These use labeled links with tooltips; no fictional contact destinations are added to demo profiles. Network details shows the same destinations with text labels. The expandable Other contact field preserves free-text contact entry and editing.
- Profile's contact fields are optional and private by default, with independent sharing controls. URL fields accept HTTP(S), LinkedIn links must use its domain, and email accepts a single address. These remain temporary demo-session data, included in the existing profile export.
- Network's expanded connection details show identity, project summary, common ground, reciprocal skills, and compact Compatibility context first. Bio, goals, and the full skill profile sit under **More about**. Follow-up tools start closed under **Your follow-up**; opening **Draft a message** within it reveals Keep in touch, the selected person's portrait, an editable prefilled message, and the white Copy message action. Suggestions use current, visible shared interests; otherwise use a neutral greeting. Drafts reset when the recipient or suggested context changes and are not saved or sent.
- Draft fields use three rows, 12px padding, a faint fill, a 1px border, and the shared control radius. Leave 12px before the copy action. Fields remain vertically resizable.
- All events, Event details, and View network use text that brightens and underlines on hover/focus. Keep the forward arrow on Enter room and copy icon on Copy message. Event's existing connection-row presentation remains unchanged.

### Profile editor

Profile uses four directly addressable tabs: About, Focus, Contact, and Settings. Home-style opaque panels, inset dividers, 20px panel headings, 14px field labels, and 15–16px input text replace the long undifferentiated form. The active section owns its Save changes and Discard changes actions; dirty indicators describe other unsaved sections without a completion score. Drafts survive navigation and tab refresh within the same session.

About includes a portrait with a small, unframed pencil upload icon and an invisible 44px hit area. Uploads preview before saving; omit persistent file requirements and a Remove photo action. Show preparation or validation feedback only when needed. Focus uses clear field names and topic controls with a visible Add action. Sharing controls remain beside their fields; browser preferences are separated from saved profile settings.

The compact nearby preview sits beside About and Focus only when space permits. Contact and Settings use a centered single column, capped at 960px and filling the available width below that, rather than retaining an empty preview column. Keep the page heading and tab bar stable between sections. The preview link inside the room card opens a focus-managed drawer with pill-shaped room/saved-connection audience controls. Its shared PanelHeader title/subtitle/divider pattern matches the editor. Distant, Nearby, and Matched controls live within the room card and update one scene; they are not a separate bottom disclosure. Shared details and the saved-connection view use opaque panels with divided field groups. On phones, retain the preview link below the form without the image rail, stack fields, use 16px input text, and retain the four short tabs. Save controls remain reachable; short viewports use a normal-flow footer. Glass is confined to the image-backed room preview.

### Inputs / Fields

Inputs are opaque charcoal, at least 44px tall, with 14px text and 9–10px corners. Room codes use uppercase tracking. Focus changes the border to jade with a restrained outer ring.

### Profile pills

- Skills, interests, looking-for topics, shared interests, and profile topics use the original profile-pill treatment everywhere. Section labels carry the semantic distinction; pill geometry does not change by topic type.
- The shared recipe uses the graphite canvas (`#101113`) inside charcoal panels, a `#ffffff26` edge, clear 12px text, a restrained inset highlight, 26px minimum height, and `3px 9px` padding.
- Removable pills use `3px 5px 3px 9px` spacing with a circular 24px remove affordance. Suggestion and overflow pills use the same base and brighten softly on hover or keyboard focus.
- Status badges, filters, segmented controls, counts, and navigation tabs remain separate component families.

### Navigation

Home, Event, Network, and Profile are the primary destinations. Spatial preview remains secondary; Experience map is direct-link only. A single pill-shaped background follows the selected sidebar item in a brief, interruptible slide; hover only brightens the label. Reduced motion places the pill without travel. Active navigation uses a quiet neutral fill, semibold (600) white text, and white icons.

### Event Phase Control

Before / During / After is a compact segmented control labeled “Preview event state.” It appears only inside an opened event and represents explicit simulated state, not real timing.

### Spatial Browser Preview

The entry card accepts an event code when no event session exists, or shows **Enter preview** for an existing session. The entry retains the event photograph. After entry, a populated illustrative room places frosted identity labels above photographed heads. Photo and anchors share one coordinate plane; matches change material without moving identities. The photo has fixed Jordan, Leo, and Maya anchors; unavailable identities leave their anchors empty, and other attendees are accessible in People. Narrow screens pan the room with swipe or Look around arrows instead of stacking cards. DEMO starts with a visibly labeled sample match; other event codes retain live matching. Selecting a person opens the common-ground panel. The private footer offers **Save connection**, then confirms **Saved to your network** and returns with **Back to the room**. **Back to event** leaves the preview and routes home. The preview controls are secondary and expose distance, demo match, appearance, interruption/restore, and reset scenarios; they do not add calibration, readiness, or an extra spatial recap state. Neutral or distant people use compact identity labels. Compatible nearby people use a wider, shorter card with 15px names, 12px supporting type, a hairline, and a one-line shared-context summary instead of repeated interest pills. Room cards reuse the published neutral spatial glass gradient and 30px blur in every state; a match lights the green edge and shadow without replacing the glass with a solid green fill. Start conversation is available for the three photographed demo people and explicitly previews a quiet room: only the selected identity remains, with an In conversation label. Finish conversation reopens that same profile; saving remains a separate action. No microphone sensing, automatic conversation detection, or backend presence state is implied.

Long person/profile details use an opaque charcoal panel with a scrollable body and fixed save footer. The room's glass is reserved for the scene, cards, pills, people dock, and short overlays; the reading body stays opaque for contrast.

## Do's and Don'ts

### Do:

- **Do** preserve the approved hybrid: v1 proportions and nested structure with v2 typography and interactions.
- **Do** keep room imagery prominent while maintaining readable contrast and honest demo labels.
- **Do** use achromatic frosted glass for spatial context and neutral opaque surfaces for product work.
- **Do** keep event browsing separate from the opened-event phase preview.
- **Do** keep the room path and save action clear at supported viewport sizes, with long person content scrolling above the fixed footer.

### Don't:

- **Don't** use dark green or olive as the base application surface.
- **Don't** expand compact product pages into analytics dashboards or oversized hero layouts.
- **Don't** apply glass to forms, long reading panels, or every card.
- **Don't** use jade as decoration, popularity, score, or public ranking.
- **Don't** add calibration, readiness, automatic conversation detection, or spatial-recap states to the browser preview, or claim headset/device proof from it.
