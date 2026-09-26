---
name: Align Spatial Salon
description: A compact spatial networking app with Linear-like discipline and restrained salon depth.
colors:
  graphite-background: "#101113"
  surface: "#191A1D"
  raised: "#222428"
  text: "#F2F3F5"
  muted: "#A8ABB2"
  quiet: "#93979F"
  hairline: "#FFFFFF14"
  control-subtle: "#FFFFFF06"
  control-border: "#FFFFFF20"
  jade: "#69E6A6"
  jade-ink: "#103622"
  spatial-sage: "#B8E4C1"
  spatial-sage-text: "#E8EDDF"
typography:
  display:
    fontFamily: "Geist Variable, Inter Variable, sans-serif"
    fontSize: "clamp(28px, 3vw, 42px)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist Variable, Inter Variable, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
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
    rounded: "{rounded.control}"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.control-subtle}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
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
    backgroundColor: "{colors.control-subtle}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
---

# Design System: Align Spatial Salon

## Overview

**Creative North Star: "Spatial Salon"**

Align combines a neutral, Linear-like application shell with the intimacy of a modern salon. The interface stays compact, quiet, and operational until a room image or spatial scene earns atmosphere. The approved hybrid preserves the original v1 proportions and nested containers while using the sharper v2 typography, login, header, preview, and interaction language.

Reference fidelity is additive, not a license to redesign: retain the old Event two-column photo cards and compact Home, Network, and Profile composition; use the final v2 type and shell; reveal Before / During / After only after an event is opened. Silver-sage glass is inherited from the archived spatial material and belongs over imagery or inside the spatial experience.

**Key Characteristics:**

- Neutral charcoal application layers with disciplined jade state cues.
- Compact, readable 13–14px interface text and 11–12px metadata.
- Opaque nested work surfaces; glass only where scene depth justifies it.
- Photographic event rooms and spatial panels provide warmth without tinting the shell green.
- Setup and readiness remain visible without requiring internal scrolling.

## Colors

The palette is neutral charcoal and cool gray; sage appears in spatial material, while bright jade is reserved for meaningful state.

### Primary

- **State Jade** (`#69E6A6`): readiness, live state, active navigation details, positive matching, focus, and completion.

### Neutral

- **Graphite Background** (`#101113`): app canvas and deepest layer.
- **Charcoal Surface** (`#191A1D`): cards, forms, and primary work surfaces.
- **Raised Charcoal** (`#222428`): selected segments and nested controls.
- **Primary Text** (`#F2F3F5`): headings and high-priority interface copy.
- **Muted Gray** (`#A8ABB2`) and **Quiet Gray** (`#93979F`): support text and metadata.
- **Hairline White** (`#FFFFFF14`): low-contrast borders and dividers.
- **Spatial Sage** (`#B8E4C1`) and **Sage Text** (`#E8EDDF`): spatial overlays and matched-room material only.

**The State Color Rule.** Jade communicates readiness, live state, a compatible reason to meet, selection, or completion. It is never decorative and never implies public ranking.

**The Neutral Base Rule.** Opaque backgrounds remain graphite or neutral charcoal; do not turn the application shell olive or dark green.

## Typography

**Display Font:** Geist Variable with Inter Variable fallback  
**Body Font:** Inter Variable with system sans-serif fallback

**Character:** Geist gives major moments a clean, contemporary edge; Inter keeps dense product work direct and readable.

### Hierarchy

- **Display** (450–600, 28–53px, 1–1.16): page headings, cinematic event titles, login, and spatial setup.
- **Title** (500–600, 17–24px): card titles, panel headings, and person names.
- **Body** (400, 13–14px, 1.5–1.7): descriptions, guidance, and connection reasons.
- **Label** (600–700, 11–12px): state, metadata, codes, and segmented controls; uppercase only for compact status labels.

**The Compact, Not Tiny Rule.** Core support copy and controls remain 13–14px; 11–12px is limited to metadata and status labels.

## Layout

Desktop uses a 230px sidebar, an 80px header, and a content canvas capped near 1420–1450px with approximately 40px page padding. Layouts use restrained nested grids rather than dashboard metric blocks.

- **Home:** a 340px photographic launch hero over a compact two-column connections/readiness composition. Preserve v1 proportions.
- **Event browse:** room-code entry followed by the original two-column photographic event cards. Before / During / After controls are absent until an event is opened.
- **Event detail:** compact title and phase control; Before uses a `1.45fr / 0.65fr` overview and readiness split; During keeps a 340px scene with its setup card fully visible; After uses a restrained recap plus two-column detail panels.
- **Network and Profile:** preserve compact v1 nested-panel proportions while using the v2 type, preview, and control treatments.
- **Spatial:** the scene leads. Setup is centered inside the stage and compresses at short heights so the complete card remains visible without internal scrolling.

At roughly 1050–1100px, major grids collapse or reduce columns. At 800–820px, the shell and event compositions stack. At 620px and below, page padding tightens and cinematic content becomes vertical; 44px touch targets remain intact.

## Elevation & Depth

The app shell is flat and tonal by default. Opaque surfaces separate through charcoal steps and hairline borders. Depth appears over photography and inside spatial mode through blur, subtle inset highlights, and low ambient shadows.

- **Cinematic ambient:** `0 22px 70px #070A071F` for image-led event frames.
- **Spatial panel:** `0 18px 50px rgb(0 0 0 / 30%)` with inset light and dark edges.
- **Matched glass:** original v1 `linear-gradient(120deg, #89A78CAA, #436B50C7)` with a pale jade edge and white text.
- **Neutral glass:** `linear-gradient(140deg, #C0C2C742, #292C32B8)` for setup panels, neutral identities, drawers, and the dock. Neutral surfaces have no green tint. Profile and live-room cards share these material tokens.

**The Earned Glass Rule.** Use glass only over imagery, within the room stage, or for a short spatial overlay. Forms and long reading surfaces stay opaque.

## Shapes

Controls use 7–12px radii, ordinary panels 14px, cinematic frames 16–18px, and spatial feature panels 22–27px. Pills are reserved for tags, statuses, and small segmented state. Borders are one-pixel translucent hairlines; avatars and completion marks may be circular.

## Components

### Buttons

- Minimum height is 44px with 13–14px medium-weight text.
- Primary actions are warm-white on graphite; jade buttons are reserved for stateful spatial actions.
- Secondary buttons use a translucent neutral fill and hairline border. Hover raises contrast gently; focus uses a 2px jade outline with 4px offset.

### Cards / Containers

- Product panels use `#191A1D`, a 14px radius, a hairline border, and 20–24px padding.
- Event browse retains two large photo cards with 22–24px titles and 12–13px supporting copy.
- Nested Network/Profile surfaces remain compact and clearly subordinate to the page shell.

### Inputs / Fields

Inputs are opaque charcoal, at least 44px tall, with 14px text and 9–10px corners. Room codes use uppercase tracking. Focus changes the border to jade with a restrained outer ring.

### Navigation

Home, Event, Network, and Profile are the primary destinations. Preview and Map remain secondary. Active navigation uses a quiet neutral fill, light text, and a jade icon detail—never a large colored rail.

### Event Phase Control

Before / During / After is a compact segmented control labeled “Preview event state.” It appears only inside an opened event and represents explicit simulated state, not real timing.

### Spatial Setup Panel

The setup panel is centered silver-sage glass, no wider than 420px, with compact responsive variants for short viewports. Keep every setup step and primary action visible without an internal scrollbar.

## Do's and Don'ts

### Do:

- **Do** preserve the approved hybrid: v1 proportions and nested structure with v2 typography and interactions.
- **Do** keep room imagery prominent while maintaining readable contrast and honest demo labels.
- **Do** use silver-sage glass for spatial context and neutral opaque surfaces for product work.
- **Do** keep event browsing separate from the opened-event phase preview.
- **Do** keep setup content fully visible at supported viewport heights.

### Don't:

- **Don't** use dark green or olive as the base application surface.
- **Don't** expand compact product pages into analytics dashboards or oversized hero layouts.
- **Don't** apply glass to forms, long reading panels, or every card.
- **Don't** use jade as decoration, popularity, score, or public ranking.
- **Don't** invent live timing, shareability, persistence, or non-demo product claims.
