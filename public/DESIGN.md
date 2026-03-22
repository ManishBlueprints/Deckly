# Design System Document: High-End Venture & Investment Editorial

## 1. Overview & Creative North Star
### The Digital Curator
In the high-stakes world of venture capital, clarity is power. This design system departs from the cluttered, "SaaS-standard" dashboard to embrace an editorial, curated aesthetic. We treat data like a gallery and investment decks like artifacts. 

The "Digital Curator" philosophy breaks traditional rigid grids through **intentional asymmetry** and **tonal depth**. By utilizing high-contrast typography and a monochromatic foundation punctuated by "Neon Kinetic" accents, we create a space that feels authoritative, silent, and premium. We eschew standard borders in favor of structural shadows and background shifts, ensuring the UI never distracts from the high-value content it holds.

---

## 2. Colors
Our palette is rooted in absolute depth, moving from a deep `#131313` base to lighter surface tiers that mimic physical layers.

*   **Primary (The Kinetic Edge):** `primary (#54e98a)` is our "Neon Green" signal. Use it sparingly for primary actions, success states, and high-importance toggles. 
*   **Neutral (The Monolith):** A spectrum of grays from `surface_container_lowest (#0e0e0e)` to `surface_bright (#3a3939)`.
*   **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. Structural boundaries must be defined solely by background color shifts (e.g., a `surface_container_low` sidebar sitting against a `surface` main stage) or subtle tonal transitions.
*   **Surface Hierarchy & Nesting:** Depth is achieved by nesting. An inner folder view should use `surface_container_high` if it sits within a `surface_container` parent. This "Paper-on-Paper" effect creates a tactile, sophisticated environment.
*   **The Glass & Gradient Rule:** For floating modals and dropdowns, utilize **Glassmorphism**. Apply `surface_variant` at 60% opacity with a `20px` backdrop blur. Use subtle linear gradients (transitioning from `primary` to `primary_container`) for main CTAs to provide a sense of "light" within the dark void.

---

## 3. Typography
We utilize **Manrope** for its modern, geometric construction that maintains professional legibility at all scales.

*   **Display & Headline (The Statement):** `display-lg` (3.5rem) and `headline-lg` (2rem) are used for high-level portfolio overviews. These should use tight letter-spacing (-0.02em) to feel authoritative and editorial.
*   **Title (The Navigator):** `title-md` (1.125rem) is the workhorse for card headings and folder names. It provides a clear, bold anchor for the user’s eye.
*   **Body & Label (The Data):** `body-md` (0.875rem) handles the bulk of investment data. To emphasize the premium nature of the platform, use `label-sm` (0.6875rem) in uppercase with increased letter-spacing (+0.05em) for secondary metadata like timestamps or tag categories.

---

## 4. Elevation & Depth
This system rejects traditional "boxed-in" UI. We use light and layering to direct focus.

*   **The Layering Principle:** Depth is "stacked." Place a `surface_container_lowest` deck card on a `surface_container_low` folder section to create a soft, natural lift without a border.
*   **Ambient Shadows:** For floating elements (FABs, Modals), use extra-diffused shadows.
    *   *Spec:* `0px 24px 48px rgba(0, 0, 0, 0.4)` tinted with `surface_tint`.
*   **The "Ghost Border" Fallback:** If a divider is mandatory for accessibility, use the **Ghost Border**: the `outline_variant` token at **15% opacity**. Never use 100% opaque lines.
*   **Backdrop Blur:** Any element that hovers (Tooltips, Modals) must use a backdrop blur of `12px` to ensure the "Curator" aesthetic remains cohesive, allowing the background colors to bleed through and soften the composition.

---

## 5. Components

### Folder Structure & Navigation
*   **Navigation Links:** Use `surface` for inactive states. For active states (e.g., "Saved Decks"), use a subtle `surface_container_highest` background with a `primary` vertical "whisper" line (2px wide) on the far left.
*   **Folder Items:** Folders should not have boxes. They are identified by `title-sm` typography and a leading `primary` icon. Hover states use a `surface_container_low` flood.

### Cards (Investment Decks)
*   **Styling:** Cards use `surface_container_low`. No borders.
*   **Separation:** Instead of dividers between rows, use `spacing-6` (1.5rem) of vertical white space to let the content breathe.
*   **Interaction:** On hover, a card should transition to `surface_container_high` with a `0.25rem (DEFAULT)` corner radius.

### Tag Chips
*   **Visuals:** Use `secondary_container` for the background and `on_secondary_container` for text.
*   **Shape:** Always `full` roundedness to contrast against the sharp, architectural lines of the folders.

### Modals (Rename/Create Folder)
*   **Structure:** Centered, `surface_container_highest` background, `xl (0.75rem)` rounded corners.
*   **Input Fields:** Use `surface_container_lowest` for the input track. The active focus state is a `primary` "Ghost Border" at 40% opacity. Forbid 100% opaque strokes.

### Floating Action Button (FAB)
*   **Visuals:** High-contrast `primary` background with `on_primary` icon. 
*   **Elevation:** This is the highest point in the UI. Use the Ambient Shadow spec.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical margins. If a sidebar is `spacing-10` from the edge, consider making the header `spacing-12` to create a dynamic, editorial flow.
*   **Do** use `primary_fixed_dim` for subtle "Neon" accents that don't overwhelm the eye during long working sessions.
*   **Do** utilize `surface_container_lowest` for the deepest parts of the UI (like the main background) to make content "pop" forward.

### Don't
*   **Don't** use a 1px white or grey line to separate the sidebar from the main content. Use a transition from `surface_container_low` to `surface`.
*   **Don't** use standard "drop shadows" that are harsh and black. Always blur and tint your shadows to the surface color.
*   **Don't** cram information. If the screen feels full, increase the spacing using the `spacing-8` or `spacing-10` tokens. In this system, space is a luxury.