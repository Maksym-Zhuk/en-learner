---
name: en-learner
description: Vocabulary study tool for Ukrainian speakers learning English
colors:
  bg-base: "#0f1117"
  bg-surface: "#161b27"
  bg-elevated: "#1e2535"
  bg-subtle: "#252d3d"
  accent: "#10b981"
  accent-hover: "#059669"
  accent-glow: "#10b98126"
  success: "#22c55e"
  danger: "#ef4444"
  warning: "#f59e0b"
  text-primary: "#f1f5f9"
  text-secondary: "#94a3b8"
  text-muted: "#475569"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-ghost-hover:
    backgroundColor: "{colors.bg-elevated}"
  button-icon:
    backgroundColor: "{colors.bg-elevated}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    size: "40px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  nav-link-active:
    backgroundColor: "{colors.accent-glow}"
    textColor: "{colors.accent}"
---

# Design System: en-learner

## 1. Overview: The Focused Night Session

**Creative North Star: "The Focused Night Session"**

Late evening. One browser tab. Vocabulary lists in front of you. The interface is the ambient light: always present, never competing with the content it holds. This system is built for a single user who knows what they want: to review vocabulary efficiently and leave. Every surface is subordinate to the word on the screen.

The deep indigo charcoal backgrounds create a contained, low-stimulation environment. The single emerald accent communicates presence, progress, and correctness without demanding attention. When you look at this interface, you notice the vocabulary first. The UI second, if at all. Transitions are short. Hierarchy is loud where it matters (the word, the definition) and invisible everywhere else.

This system rejects educational software language: no streaks, no mascots, no confetti, no gamified reward loops. It also rejects generic product darkness: no gradient hero panels, no neon accents, no identical icon-grid stat banners. Depth comes from tonal surface steps, not decoration. Feedback comes from color and shape, not celebration choreography.

**Key Characteristics:**
- Single emerald accent; used sparingly across all surfaces
- Four tonal surface levels (base, surface, elevated, subtle) replace shadows for structural depth
- Inter only, hierarchy through scale and weight contrast alone
- Animations: state-driven, short, ease-out; never choreographed
- Keyboard-first patterns visible throughout (Cmd+K lookup, 1/2/3/4 quiz keys, Space to flip)

## 2. Colors: The Deep Indigo Charcoal Palette

One accent, four neutrals, three status signals. The palette is restrained by design: the emerald is the only chromatic decision, and it earns its place by doing real work.

### Primary

- **Emergence Green** (#10b981): The system's single chromatic voice. Used on primary CTAs, active navigation states, focus rings, progress fills, English word text in study modes, and mastery indicators. Its rarity across any given screen is what gives it authority.

### Secondary

- **Growth Green** (#22c55e): The success signal. Used exclusively for correct-answer states in quiz and write modes, and for mastery completion states. Never decorative.

### Tertiary

- **Alert Amber** (#f59e0b): Warning and attention states. Reserved for session timers running low and caution-level status indicators.

### Neutral

- **Night Floor** (#0f1117): The base layer. Page background, table header fill, modal overlay tint. The starting point for all depth.
- **Deep Surface** (#161b27): Resting content surfaces. Cards, auth card, section panels, flip card faces.
- **Elevated Layer** (#1e2535): Interactive element backgrounds. Input fields, button fills (ghost), badge backgrounds, icon button backgrounds.
- **Boundary Line** (#252d3d): Borders, separators, hover fills, drag-over backgrounds. The highest tonal step before text.
- **Soft Slate** (#94a3b8): Secondary text. Metadata, descriptions, nav links at rest, phonetic annotations.
- **Receded Mist** (#475569): Muted text. Column headers, placeholder labels, icon default color, contextual hints.
- **Near White** (#f1f5f9): Primary text. Headings, body copy, active interactive labels.
- **Danger Red** (#ef4444): Error and incorrect-answer states. Wrong quiz choices, form field errors. Never decorative.

### Named Rules

**The One Voice Rule.** The emerald accent (#10b981) appears on no more than 15% of any given screen. Its scarcity is its power. Every additional use must answer: "Is this the most important thing on this screen right now?"

**The Status-Only Rule.** Success (#22c55e), danger (#ef4444), and warning (#f59e0b) are reserved strictly for feedback states: correct, incorrect, caution. They are never used as decorative accents or brand color substitutes.

## 3. Typography

**Body Font:** Inter (with system-ui, -apple-system, sans-serif fallback). Weights 300 through 800 loaded. No secondary typeface.

**Character:** A single geometric sans-serif doing everything through scale and weight. The absence of a display font is intentional: the vocabulary words themselves are the display type. Inter at 600/36px in emerald green is the moment.

### Hierarchy

- **Display** (weight 600, 36px, line-height 1.1, letter-spacing -0.01em): English and Ukrainian words in study sessions (flip card face, quiz word, write-mode prompt). These are the product, not the UI.
- **Headline** (weight 600, 28px, line-height 1.2, letter-spacing -0.01em): Page titles (deck name in hero, home greeting). One per view.
- **Title** (weight 500, 22px, line-height 1.3, letter-spacing -0.005em): Section headings, modal titles, score displays.
- **Body** (weight 400, 15px, line-height 1.5): Definitions, descriptions, group content, form prose. Max 65-75ch per line.
- **Label** (weight 500, 11px, letter-spacing 0.08em, uppercase): Column headers in tables, status badge text, keyboard shortcut hints. The only context where uppercase is permitted.

Body at 13px (--text-sm) is used for navigation links, secondary metadata, and compact table content where 15px would be too heavy.

### Named Rules

**The Weight Bridge Rule.** Each typographic step must differ by at least 1.25x in size or one full weight grade (e.g. 400 to 600). A section heading at 18px/500 adjacent to body at 15px/400 is too flat to read as hierarchy.

**The Single Face Rule.** Inter carries the full typographic system. No secondary or decorative typeface is added. Emphasis through weight and size, never through font-family switching.

## 4. Elevation

Depth in this system is tonal, not shadow-based. Four surface steps from bg-base (#0f1117) through bg-surface (#161b27), bg-elevated (#1e2535), to bg-subtle (#252d3d) create a readable depth stack without any shadows. Surfaces are flat at rest.

Shadows exist for three specific scenarios: interactive lift on hover, floating layers (modals, toasts), and focus/selection glows. They are responses to state and elevation, not decoration.

### Shadow Vocabulary

- **shadow-sm** (`0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.19)`): Ambient resting shadow for primary buttons. Barely perceptible.
- **shadow-md** (`0 4px 16px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3)`): Hover lift for cards and interactive panels (+translateY(-3px)). Structural floating for dropdowns.
- **shadow-lg** (`0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)`): Full-screen overlays, modals. Heavy and intentional.
- **shadow-glow** (`0 0 0 1px #10b981, 0 0 20px rgba(16,185,129,0.15)`): Focus ring for inputs, selection ring for quiz/match elements. Luminous rather than structural.
- **shadow-success-glow / shadow-danger-glow**: Same ring pattern in success or danger color. Applied to the write-mode input on correct or incorrect submission.

### Named Rules

**The Flat-By-Default Rule.** A surface at rest never has a box-shadow unless it is a floating layer (modal, toast) or has the ambient-resting exception (primary button at shadow-sm). Hover and focus add shadows; presence does not.

**The Glow-for-State Rule.** Colored glow rings (accent, success, danger) are state indicators, not decorative treatments. A glowing element is telling the user something: "this is focused," "this is correct," "this is wrong."

## 5. Components

### Buttons

Character: Compact and assertive. No pill shapes. No sharp corners. Every variant communicates its intent through color, not shape.

- **Shape:** Gently curved edges (10px radius). Standard height 40px; large variant 48px (btn-lg); small variant 28px (btn-sm).
- **Primary:** Emerald fill (#10b981), white text, 0 16px padding, inset highlight (rgba(255,255,255,0.08)) + shadow-sm at rest. Darkens to #059669 and lifts 1px on hover.
- **Ghost:** Transparent fill, bg-subtle border (1px), primary text color. Fills to bg-elevated on hover.
- **Danger / Success:** Transparent with 30% opacity colored border and matching text at rest. Faint color tint floods background on hover. For destructive or confirm actions.
- **Icon button:** Square (40x40px), bg-elevated background, secondary text color, no border. No shadow. Transitions to bg-subtle background and primary text on hover.

### Inputs / Fields

Character: The floating-label pattern signals care without occupying extra vertical real estate. Inputs are the gateway to content; their focus state should feel welcoming, not alarming.

- **Style:** bg-elevated (#1e2535) background, 1px bg-subtle border, 10px radius, 52px height, 44px left padding for icon.
- **Floating label:** Sits at body size (15px) in muted color at rest. Shrinks to 11px label size in accent color when focused or filled.
- **Focus:** Accent border + shadow-glow ring. The icon transitions from muted to accent color.
- **Error:** Danger border + danger glow ring. Label and icon tint to danger.
- **Keyboard shortcut display:** kbd elements use bg-elevated background, bg-subtle border, and muted text at 11px. Used in the nav search pill (Cmd+K) and study shortcuts display.

### Cards / Containers

Character: Content containers that earn interaction through precision, not decoration. The hover lift is the only animation on the card itself.

- **Deck card:** bg-surface background, 1px bg-subtle border, 10px radius, 18px internal padding. Hover: accent border, shadow-md, 3px upward lift. Contains: emoji thumbnail (32x32px bg-elevated, 6px radius), title at 18px/500, badge metadata row, 4px progress bar with gradient fill.
- **Stat card:** bg-surface, bg-subtle border, 10px radius, 14px 16px padding. Two-level content: uppercase label (11px/500/0.08em) + large value (22px/600). Flat; no hover state.
- **Mode tile:** Same surface as deck card. Contains icon in accent-glow square (36x36px, 6px radius), title at body size, description at 11px. Arrow icon fades in and translates right on hover.
- **Auth card:** bg-surface, 24px radius, 40px 36px padding, shadow-lg. The largest contained panel in the system.

Internal padding rule: 18px for compact cards (deck, folder), 20-24px for informational panels (deck hero, modal body), 32-40px for auth/focus surfaces.

### Inputs / Text Fields

See above. The floating-label style is the only input pattern in the system. No bottom-border-only inputs, no labeled-above-field inputs.

### Navigation

Character: Ambient chrome. The navbar knows it is infrastructure, not product, and behaves accordingly.

- **Style:** Sticky top, backdrop-filter blur(12px), bg-base at ~70% opacity (#0f1117b3), 1px bg-subtle border-bottom. Padding 14px 28px.
- **Nav links at rest:** Secondary text color (#94a3b8), 6px 12px padding, 10px radius.
- **Hover:** Primary text (#f1f5f9), bg-elevated background.
- **Active:** Accent text (#10b981), accent-glow background (rgba(16,185,129,0.15)).
- **Search pill:** bg-elevated, 1px bg-subtle border, displays Cmd+K as kbd element in bg-subtle. Accent border on hover.

### Flip Card (Signature)

The study moment. The flip card is the product made visible; every other surface exists to get the user here.

- **Shape:** 24px radius, max 600px wide, 380px tall.
- **Front face:** bg-surface background, 1px bg-subtle border, shadow-md. English word at display size (36px/600) in accent green. IPA phonetic in muted text, 13px. Example sentence in italic secondary text, 15px, with the target word highlighted in a faint emerald tint (rgba(16,185,129,0.18)).
- **Back face:** Subtle linear gradient from bg-surface to #1a2030. Ukrainian translation at display size in primary text.
- **Flip animation:** 0.6s rotateY(180deg) with cubic-bezier(0.4,0,0.2,1). No spring, no bounce. backface-visibility hidden on both faces.

### Quiz Option Card (Signature)

Choices that must communicate answer state the instant the user commits. No ambiguity.

- **Resting:** bg-surface, 1px bg-subtle border, 10px radius, min-height 64px, primary text. Left edge: 22x22px keyboard shortcut key in bg-elevated. Right: feedback icon hidden (opacity 0).
- **Hover:** bg-elevated background.
- **Correct:** success-glow background, success border, success text color. Checkmark feedback fades in.
- **Wrong:** danger-glow background, danger border, danger text color. Shake animation (0.4s horizontal oscillation at ±6px, ±4px). Feedback icon fades in.

### Badges

Small, pill-shaped metadata tags. Always inline with content, never standalone.

- **Default:** bg-elevated background, secondary text, 1px bg-subtle border, full-radius (9999px), 3px 8px padding, 11px/500 text.
- **Accent variant:** accent-glow background, accent text, semi-transparent accent border (30% opacity). Used for "due" counts and active status.
- **Success / warning variants:** Matching tint (15% opacity), text, and border (30% opacity) in the corresponding status color.

## 6. Do's and Don'ts

### Do

- **Do** use the emerald accent on no more than 15% of any given screen. Count before adding.
- **Do** let the English word dominate at 36px/600 in accent color during study sessions; it IS the hierarchy.
- **Do** use tonal surface steps (base to surface to elevated to subtle) for structural depth before reaching for any shadow.
- **Do** keep all transitions at 200ms ease-in-out for standard state changes; use cubic-bezier(0.4,0,0.2,1) for entrances.
- **Do** surface keyboard shortcuts as kbd elements wherever they exist. Every reachable shortcut should be visible.
- **Do** use uppercase labels (11px, 0.08em tracking) only for column headers, status tags, and contextual hints — never headings.
- **Do** match shadow weight to floating height: shadow-sm for resting interactive, shadow-md for hover lift, shadow-lg for overlays.
- **Do** keep body text at or below 65-75ch per line on content-reading surfaces.
- **Do** use the emerald tint highlight (rgba(16,185,129,0.18), 4px radius) to mark the target word inside example sentences.

### Don't

- **Don't** add streaks, mascots, confetti, or gamified reward loops of any kind. Learning is the reward. (Anti-reference: Duolingo.)
- **Don't** add gradient hero stat panels, "X words learned" banners, or identical icon-grid card layouts. (Anti-reference: generic SaaS product dashboards.)
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, callouts, or list items. Rewrite with full borders, background tints, or leading icons.
- **Don't** use gradient text (`background-clip: text` with a gradient). Single solid color only; emphasis through weight or size.
- **Don't** use success (#22c55e), danger (#ef4444), or warning (#f59e0b) as decorative accents. They communicate state only.
- **Don't** add box-shadow to resting, non-interactive elements. Shadows are responses to state (hover, focus) or height (modal, floating).
- **Don't** add a second typeface. Inter at weight 600 for display, 500 for labels, 400 for body is the entire typographic system.
- **Don't** animate layout properties (height, width, padding, margin). Animate transform and opacity only.
- **Don't** nest cards. A card inside a card is always the wrong answer.
- **Don't** use modals as the first solution for inline actions. Exhaust inline or progressive alternatives before floating a panel.
