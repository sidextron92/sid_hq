# Liquid Glass Design System

Design language for the Control Centre app. All UI elements follow this system to maintain visual consistency.

---

## Foundation

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `--bg-void` | `#09090b` | Page background |
| `--bg-card` | `#141419` | Elevated card surfaces (non-glass) |
| `--text-main` | `#fcfcfd` | Primary text |
| `--text-muted` | `#8a8a98` | Secondary text, labels |
| `--accent-border` | `rgba(255,255,255,0.06)` | Subtle borders |
| `--accent-glow` | `rgba(255,255,255,0.03)` | Ambient glow |

### Typography

- **Font**: Nunito (Google Fonts)
- **Weights**: 400 (body), 600 (semibold labels), 700 (bold UI), 800-900 (headings)
- **Section labels**: `text-sm font-bold uppercase tracking-widest` in `--text-muted`

---

## Core Primitive: LiquidGlassWrap

**File**: `src/components/glass/LiquidGlassWrap.tsx`

The foundation of every glass element. A self-contained component with all layers inside a single `div` (no Fragment siblings). Works in any layout context — flex, grid, flow.

### Architecture (7 layers, bottom to top)

```
Layer 1: overLight tint      — black overlay (mix-blend: overlay, 15% opacity). Only renders when overLight=true.
Layer 2: Backdrop warp       — backdrop-filter: blur + saturate, with SVG displacement filter applied.
                                The SVG filter does chromatic aberration (R/G/B displaced at different scales)
                                using a pre-baked squircle displacement map.
Layer 3: Hover highlight     — radial-gradient white glow that follows the cursor (mix-blend: overlay).
                                Fades in on mouse enter, out on mouse leave. Provides specular feedback.
Layer 4a: Color tint (normal)  — Colored fill (normal blend, 55% opacity). Provides solid color base visible on any background.
Layer 4b: Color tint (overlay) — Same color (mix-blend: overlay, 60% opacity). Adds depth and interaction with backdrop.
                                 Both layers only render when tint is set.
Layer 5: Border shine (screen) — 1.5px edge highlight using mask-composite: xor trick.
                                  Linear gradient rotates with mouse position. mix-blend-mode: screen.
Layer 6: Border shine (overlay) — Same as Layer 5 but with mix-blend-mode: overlay for metallic sheen.
Layer 7: Content              — Your children, z-index: 1, with text-shadow for legibility.
```

### Behavior

- **Text selection** is disabled (`select-none`) on all glass elements to prevent accidental highlighting during drag/hover. Override with `className="select-text"` on specific content if needed.
- **Hover** triggers both the radial highlight glow (Layer 3) and the elasticity cursor-follow effect.
- **Elasticity** computes directional stretch (scaleX/scaleY) based on cursor distance and angle, with a 200px activation zone.

### Props Reference

| Prop | Type | Default | Range | Description |
|---|---|---|---|---|
| `displacementScale` | `number` | `100` | 0–200 | Refraction intensity. How much the background bends at glass edges. 0 = flat, 200 = extreme warp. |
| `blurAmount` | `number` | `5` | 0–40 | Frosting level in px. 0 = perfectly clear glass, 40 = fully opaque frost. |
| `saturation` | `number` | `140` | 100–300 | Backdrop color saturation %. 100 = normal, 200+ = vivid colors through glass. |
| `aberrationIntensity` | `number` | `2` | 0–10 | Chromatic aberration. RGB channel separation at edges. 0 = clean, 10 = heavy rainbow fringing. |
| `elasticity` | `number` | `0.3` | 0–1 | Cursor-follow. The glass translates and directionally stretches toward the mouse. 0 = static. |
| `overLight` | `boolean` | `false` | — | Enables dark tint for use on bright/white backgrounds. Halves text-shadow. |
| `shadowIntensity` | `number` | `1` | 0–2 | Drop shadow depth. 0 = no shadow, 1 = standard elevation, 2 = heavy floating. |
| `borderOpacity` | `number` | `1` | 0–1 | Border shine visibility. 0 = no edge highlight, 1 = full shine. |
| `tint` | `string` | `undefined` | CSS color | Adds a colored overlay. Use with low-opacity colors: `rgba(99,102,241,0.3)` for indigo glass. |
| `cornerRadius` | `number` | `32` | 0–999 | Border radius in px. Use 100+ for pill shapes, 999 for circles. |
| `padding` | `string` | `"24px 28px"` | CSS padding | Content padding. |
| `onClick` | `() => void` | — | — | Makes the element clickable (adds cursor: pointer). |

### Recommended Presets

```tsx
// Standard card (uses all defaults: blur 5, displacement 100, radius 32, elasticity 0.3)
<LiquidGlassWrap />

// Pill button
<LiquidGlassWrap cornerRadius={100} padding="14px 28px" />

// Frosted panel (heavy blur, low refraction)
<LiquidGlassWrap blurAmount={35} displacementScale={30} saturation={120} />

// Clear lens (no blur, high refraction, strong aberration)
<LiquidGlassWrap blurAmount={0} displacementScale={150} aberrationIntensity={5} />

// Heavy cursor-follow
<LiquidGlassWrap elasticity={0.6} shadowIntensity={1.5} />

// Tinted glass
<LiquidGlassWrap tint="rgba(99, 102, 241, 0.3)" />

// For bright/wallpaper backgrounds
<LiquidGlassWrap overLight />

// Static (no cursor-follow, no hover highlight)
<LiquidGlassWrap elasticity={0} />
```

---

## Component Library

All components are in `src/components/glass/`. Barrel export from `index.ts`.

### GlassCard

**File**: `GlassCard.tsx`

Container card with optional drag support. Uses `LiquidGlassWrap` internally.

```tsx
<GlassCard>Static content</GlassCard>
<GlassCard draggable>Drag me around</GlassCard>
<GlassCard cornerRadius={16} padding="16px 20px">Compact card</GlassCard>
```

**Props**: `children`, `className`, `draggable`, `cornerRadius`, `padding`, `style`

**Drag behavior** (GSAP):
- Pointer down: `scale: 1.03`, ease `back.out(1.7)`
- During drag: incremental `x/y` translation
- Pointer up: `scale: 1`, ease `elastic.out(1, 0.5)`

### GlassButton

**File**: `GlassButton.tsx`

Pill-shaped button with GSAP spring animations. Always `cornerRadius={100}`.

```tsx
<GlassButton onClick={handleClick}>Click me</GlassButton>
<GlassButton size="sm">Small</GlassButton>
<GlassButton size="lg">Large</GlassButton>
<GlassButton disabled>Disabled</GlassButton>

// Destructive / danger (red glass tint)
<GlassButton tint="rgba(239, 68, 68, 0.35)">Delete</GlassButton>

// Custom tint
<GlassButton tint="rgba(99, 102, 241, 0.3)">Indigo</GlassButton>
```

**Props**: `children`, `onClick`, `className`, `size` (`sm|md|lg`), `disabled`, `tint` (CSS color — passed to `LiquidGlassWrap` tint layer)

**Size map**:
- `sm`: padding `10px 20px`, font `13px`
- `md`: padding `14px 28px`, font `15px`
- `lg`: padding `18px 36px`, font `17px`

**Interaction (GSAP)**:
- Hover enter: `scale: 1.05`, ease `back.out(1.7)`
- Hover leave: `scale: 1`, ease `elastic.out(1, 0.5)`
- Mouse down: `scale: 0.92`, ease `power2.out`
- Mouse up: `scale: 1.05`, ease `elastic.out(1, 0.4)`

### TactileSwitch

**File**: `TactileSwitch.tsx`

Liquid glass toggle switch inspired by [kube.io](https://kube.io/blog/liquid-glass-css-svg/). The thumb is deliberately larger than the track and uses SVG displacement + backdrop-filter for the glass effect. Toggle only commits on release, not on press.

```tsx
<TactileSwitch checked={isOn} onChange={setIsOn} />
```

**Props**: `checked`, `onChange`, `disabled`, `className`

**Visual spec**:
- Track: `160x67px`, fully rounded (`radius: 33.5px`)
  - OFF: `rgba(148, 148, 159, 0.47)` (gray)
  - ON: `rgba(59, 191, 78, 0.93)` (green)
- Thumb: `146x92px` (larger than track), fully rounded (`radius: 46px`)
  - At rest: `scale(0.65)`, opaque white `rgba(255,255,255,1)`, `shadow: 0 4px 22px rgba(0,0,0,0.1)`
  - Pressed/glass mode: `scale(0.9)`, transparent `rgba(255,255,255,0.1)` — track color shows through glass
  - SVG displacement filter with squircle map, `feColorMatrix saturate(6)` for vivid refraction
  - Border shines: screen + overlay gradient masks (same technique as LiquidGlassWrap)
- Travel distance: `57.9px`
- Margin-left offset: `-22px` (centers oversized thumb on track)

**Interaction model** (three modes):

1. **Tap**: press → thumb expands to glass mode → release → toggle fires, thumb slides to opposite side + shrinks back to solid
2. **Drag**: press → expand to glass → drag thumb left/right (clamped 0–57.9px) → track color interpolates in real-time → release → snaps to whichever side is closest (>50% = commits)
3. **Hold**: press → thumb stays expanded/glassy at current position indefinitely → release triggers toggle

**GSAP animations**:
- Press expand: `scale → 0.9`, ease `back.out(1.4)`, 0.3s
- Press bg fade: `rgba(255,255,255,1) → 0.1`, ease `power2.out`, 0.25s
- Release slide: `x → 0 or 57.9`, `scale → 0.65`, ease `elastic.out(1, 0.7)`, 0.5s
- Release bg restore: `rgba(255,255,255,0.1) → 1`, ease `power2.out`, 0.35s
- Track color: ease `power2.out`, 0.4s (or real-time interpolation during drag)
- Dead zone: 4px before drag is recognized (prevents accidental drag during tap)

### DragDock

**File**: `DragDock.tsx`

Navigation dock with a sliding glass indicator behind the active item.

```tsx
<DragDock
  items={[
    { id: "home", label: "Home", icon: <HomeIcon /> },
    { id: "tasks", label: "Tasks", icon: <TaskIcon /> },
  ]}
  onSelect={(id) => setActive(id)}
/>
```

**Props**: `items` (`{id, label, icon}[]`), `activeId`, `onSelect`, `className`, `direction` (`horizontal|vertical`)

**Visual spec**:
- Container: `bg: rgba(0,0,0,0.35)`, `border: 1px solid rgba(255,255,255,0.08)`, `radius: 20px`
- Indicator: CSS glass (`backdrop-filter: blur(12px) saturate(140%)`, `border: 1px solid rgba(255,255,255,0.15)`)
- Active icon: `scale(1.15) translateY(-1px)`, `drop-shadow(0 0 6px rgba(255,255,255,0.35))`
- Animation (GSAP): position ease `elastic.out(1, 0.7)`, stretch `scaleX: 1.12→1` ease `elastic.out(1, 0.5)`

### SegmentControl

**File**: `SegmentControl.tsx`

Tab switcher with rubber-band stretching glass indicator.

```tsx
<SegmentControl
  segments={["Board", "List", "Timeline"]}
  activeIndex={0}
  onChange={(i, label) => setTab(i)}
/>
```

**Props**: `segments` (`string[]`), `activeIndex`, `onChange`, `className`

**Visual spec**:
- Container: `bg: rgba(0,0,0,0.3)`, pill shape, `inset shadow: 0 2px 6px rgba(0,0,0,0.3)`
- Indicator: same CSS glass as DragDock, pill shape
- Each segment: `min-width: 80px`, `padding: 10px 24px`, `font: 14px bold`
- Active: `opacity: 1`, inactive: `opacity: 0.5`
- Animation (GSAP): position ease `elastic.out(1, 0.65)`, stretch `scaleX: 1.15→1` ease `elastic.out(1, 0.5)`

### FluidInput

**File**: `FluidInput.tsx`

Liquid glass search/input field inspired by [kube.io](https://kube.io/blog/liquid-glass-css-svg/). Uses `LiquidGlassWrap` with tuned parameters for an input-specific look. Built-in search icon (Ionicons style).

```tsx
// Default with built-in search icon
<FluidInput placeholder="Search tasks..." value={query} onChange={setQuery} />

// Custom icon
<FluidInput icon={<MyIcon />} placeholder="Filter..." value={v} onChange={setV} />

// Custom width
<FluidInput width={400} placeholder="Search everything..." />
```

**Props**: `placeholder`, `value`, `onChange`, `type` (default `"search"`), `className`, `icon` (default: built-in search icon), `width` (default: `320`)

**Visual spec** (matches kube.io search box):
- Dimensions: `320x42px`, fully rounded (`border-radius: 21px`)
- Uses `LiquidGlassWrap` with `blurAmount: 8`, `displacementScale: 80`, `elasticity: 0.15`
- Built-in search icon: Ionicons `search`, 20px, 50% opacity
- Icon + input laid out with `flex, gap: 12px, padding: 0 14px`
- Text: `16px`, `rgba(255,255,255,0.8)`, `text-shadow: 0 1px 4px rgba(0,0,0,0.5)`
- Placeholder: `rgba(255,255,255,0.35)` (set in `globals.css`)
- Border shine: `0.6` default, `1.0` on focus
- Shadow: `0.5` default, `0.8` on focus
- `select-text` on the input itself (overrides glass `select-none`)

**Interaction (GSAP)**:
- Focus: `scale: 1.02`, ease `elastic.out(1, 0.6)`
- Blur: `scale: 1`, ease `elastic.out(1, 0.5)`
- Mouse down: `scale: 0.96`, ease `power2.out` (press-down feel)
- Mouse up: spring back to `1.02` (if focused) or `1`
- Each keystroke: `scaleX: 1.008, scaleY: 0.996` → snap back in 0.25s (subtle breathing)

### GlassDropdown

**File**: `GlassDropdown.tsx`

Pill-shaped dropdown with a frosted glass menu panel. Trigger uses `LiquidGlassWrap` with input-tuned parameters; menu uses heavy-blur `LiquidGlassWrap`. Each option row uses the CSS glass recessed pattern. Closes on outside click or Escape.

```tsx
<GlassDropdown
  options={[
    { id: "board", label: "Board View", icon: <BoardIcon /> },
    { id: "list", label: "List View" },
    { id: "timeline", label: "Timeline", disabled: true },
  ]}
  value={view}
  placeholder="Select view..."
  onChange={(opt) => setView(opt.id)}
/>

// Custom size & width
<GlassDropdown options={opts} size="sm" width={180} />
<GlassDropdown options={opts} size="lg" width={320} />

// Disabled
<GlassDropdown options={opts} disabled />
```

**Props**: `options` (`{id, label, icon?, disabled?}[]`), `value`, `placeholder`, `onChange`, `size` (`sm|md|lg`), `disabled`, `width` (default: `240`), `className`

**Size map**:
- `sm`: padding `10px 16px`, font `13px`
- `md`: padding `14px 20px`, font `15px`
- `lg`: padding `18px 24px`, font `17px`

**Visual spec**:
- Trigger: pill shape (`cornerRadius: 100`), `LiquidGlassWrap` with `blurAmount: 8`, `displacementScale: 80`, `elasticity: 0.15`
  - Chevron icon rotates 180deg on open
  - Selected label in `--text-main`, placeholder in `--text-muted`
- Menu panel: `LiquidGlassWrap` with `blurAmount: 80`, `displacementScale: 60`, `saturation: 160`, `cornerRadius: 20`, `shadowIntensity: 1.5`, `elasticity: 0`, `tint: rgba(0, 0, 0, 0.8)`
  - Positioned below trigger (`mt-2`), full width
- Option rows: transparent background by default (`border: 1px solid rgba(255,255,255,0.08)`, `box-shadow: inset 0 2px 6px rgba(0,0,0,0.3)`)
  - Selected row: `rgba(255,255,255,0.1)` background with checkmark icon
  - Optional icon: `32px` circle with `border: 1.5px solid rgba(255,255,255,0.15)`
  - `rounded-2xl` corners

**Interaction model**:
1. **Tap trigger**: toggle menu open/closed
2. **Outside click / Escape**: closes menu
3. **Option hover**: row slides right `4px`, background lightens to `rgba(255,255,255,0.08)`
4. **Option select**: fires `onChange`, closes menu, trigger gets scale punch

**GSAP animations**:
- Trigger hover: `scale → 1.03`, ease `back.out(1.7)`, 0.3s
- Trigger leave: `scale → 1`, ease `elastic.out(1, 0.5)`, 0.4s
- Trigger press: `scale → 0.96`, ease `power2.out`, 0.15s
- Trigger release: `scale → 1.03`, ease `elastic.out(1, 0.4)`, 0.4s
- Menu open: `scale: 0.85→1`, `y: -4→0`, `opacity: 0→1`, ease `elastic.out(1, 0.6)`, 0.4s
- Menu close: `scale→0.85`, `y→-4`, `opacity→0`, ease `power2.in`, 0.2s
- Chevron rotation: `0→180deg` (open), `180→0deg` (close), ease `back.out(1.7)`, 0.3s
- Item stagger: `opacity: 0→1`, `x: -8→0`, ease `power2.out`, 0.3s, stagger `0.035s`
- Item hover: `x → 4`, ease `power2.out`, 0.25s
- Item leave: `x → 0`, ease `elastic.out(1, 0.5)`, 0.3s
- Item press: `scale → 0.97`, ease `power2.out`, 0.1s
- Item release: `scale → 1`, ease `elastic.out(1, 0.4)`, 0.3s
- Selection punch: trigger `scale: 0.96→1`, ease `elastic.out(1, 0.4)`, 0.4s

### LayeredFAB

**File**: `LayeredFAB.tsx`

Draggable magnifying-glass-style floating action button inspired by [kube.io](https://kube.io/blog/liquid-glass-css-svg/). Uses `LiquidGlassWrap` for both the capsule body and the menu panel — gets blur, refraction, hover glow, and elasticity for free. Fixed-positioned bottom-right. Rendered outside `overflow-hidden` containers (use a Fragment sibling).

```tsx
// Rendered outside the main layout div to avoid overflow clipping
<LayeredFAB
  actions={[
    { id: "add", label: "New Task", icon: <PlusIcon />, onClick: handleAdd },
    { id: "note", label: "Quick Note", icon: <NoteIcon />, onClick: handleNote },
  ]}
/>
```

**Props**: `actions` (`{id, label, icon, onClick}[]`), `className`

**Visual spec**:
- Capsule body: `160x120px`, `border-radius: 65px` (pill/capsule shape)
  - Uses `LiquidGlassWrap` with: `blurAmount: 5`, `displacementScale: 100`, `saturation: 140`, `elasticity: 0.3`, `shadowIntensity: 1.2`
  - Hover glow + elasticity cursor-follow from LiquidGlassWrap
- Icon: `+` (28px SVG), white with drop-shadow, rotates 45deg to `×` on open
- Menu panel: `LiquidGlassWrap` with `blurAmount: 12`, `displacementScale: 60`, `cornerRadius: 20`, `shadowIntensity: 1.5`
  - Positioned above capsule (`bottom: 100%, mb-3`)
  - Action items: `40px` icon circles with `border: 1.5px solid rgba(255,255,255,0.2)`, hover `bg: rgba(255,255,255,0.1)`
- Position: `fixed bottom-8 right-8 z-50`

**Interaction model** (three modes):

1. **Tap**: press → capsule scales up to `1.05` → release → menu toggles open/closed
2. **Drag**: press → scale up → drag freely across screen → velocity-based `scaleX` squish (rubbery feel, `min: 0.8`) → release → `scaleX` restores to 1
3. **Hover**: elasticity cursor-follow + radial glow from LiquidGlassWrap (no conflicting `scaleY` — all Y-axis scale animations removed to prevent fights with elasticity)

**GSAP animations**:
- Press: `scale → 1.05`, ease `elastic.out(1, 0.6)`, 0.4s
- Release: `scaleX → 1`, `scale → 1`, ease `elastic.out(1, 0.6)`, 0.5s
- Drag squish: `scaleX = max(0.8, 1 - |velocity| / 4000)` — set directly per frame
- Menu open: `scale: 0.4→1`, `y: 10→0`, `opacity: 0→1`, ease `elastic.out(1, 0.6)`, 0.5s
- Menu close: `scale→0.4`, `y→10`, `opacity→0`, ease `power2.in`, 0.25s
- Icon rotation: `0→45deg` (open), `45→0deg` (close), ease `back.out(1.7)`, 0.3s
- Dead zone: 4px before drag is recognized (prevents accidental drag during tap)

**Important**: No `scaleY` animations on the capsule. Elasticity from LiquidGlassWrap handles directional stretch via its own transform — adding GSAP `scaleY` would conflict and cause size fluctuation.

### GlassModal

**File**: `GlassModal.tsx`

Full-screen modal overlay with a frosted glass backdrop and a glass panel. Uses `LiquidGlassWrap` for the panel body. Closes on backdrop click or Escape key.

```tsx
<GlassModal open={isOpen} onClose={() => setIsOpen(false)}>
  <h2>Modal Title</h2>
  <p>Modal content goes here.</p>
</GlassModal>

// Custom width
<GlassModal open={isOpen} onClose={handleClose} width={500}>
  ...
</GlassModal>
```

**Props**: `children`, `open`, `onClose`, `className`, `width` (default: `420`)

**Visual spec**:
- Backdrop: `rgba(0, 0, 0, 0.6)`, `backdrop-filter: blur(8px) saturate(120%)`
- Panel: `LiquidGlassWrap` with `blurAmount: 25`, `displacementScale: 60`, `saturation: 160`, `cornerRadius: 24`, `shadowIntensity: 1.8`, `elasticity: 0`
- Close button: top-right, `32px` circle, `rgba(255,255,255,0.08)` background, hover brightens
- Content area: `padding: 32px`, scrollable with `max-height: calc(100vh - 96px)`

**GSAP animations**:
- Backdrop fade in: `opacity: 0→1`, ease `power2.out`, 0.3s
- Panel open: `scale: 0.85→1`, `y: 20→0`, `opacity: 0→1`, ease `elastic.out(1, 0.6)`, 0.5s
- Panel close: `scale→0.85`, `y→20`, `opacity→0`, ease `power2.in`, 0.25s
- Backdrop fade out: `opacity→0`, ease `power2.in`, 0.25s

### GlassFormField

**File**: `GlassFormField.tsx`

Labeled form input field with liquid glass styling. Similar to FluidInput but designed for forms — includes a label, no icon, and uses a rounded-rect shape instead of pill.

```tsx
<GlassFormField
  label="Name"
  placeholder="Enter your name..."
  value={name}
  onChange={setName}
/>

// Email field
<GlassFormField label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
```

**Props**: `label`, `placeholder`, `value`, `onChange`, `type` (default: `"text"`), `className`

**Visual spec**:
- Label: `text-xs font-bold uppercase tracking-widest` in `--text-muted`
- Input wrapper: `LiquidGlassWrap` with `cornerRadius: 16`, `blurAmount: 8`, `displacementScale: 80`, `elasticity: 0.15`
- Border shine: `0.6` default, `1.0` on focus
- Shadow: `0.5` default, `0.8` on focus
- Text: `15px`, `rgba(255,255,255,0.85)`, `text-shadow: 0 1px 4px rgba(0,0,0,0.5)`
- Input padding: `14px 18px`

**Interaction (GSAP)**:
- Focus: `scale: 1.02`, ease `elastic.out(1, 0.6)`
- Blur: `scale: 1`, ease `elastic.out(1, 0.5)`
- Mouse down: `scale: 0.97`, ease `power2.out`
- Mouse up: spring back to `1.02` (if focused) or `1`
- Each keystroke: `scaleX: 1.006, scaleY: 0.997` → snap back in 0.25s

### GlassSlider

**File**: `GlassSlider.tsx`
**Depends on**: `glass-map-generator.ts` (runtime physics-based displacement maps)

Liquid glass range slider inspired by [kube.io](https://kube.io/blog/liquid-glass-css-svg/). Features **true optical refraction** through the thumb — when pressed, you see the track's blue fill and unfilled region physically bent through the glass surface using Snell's law displacement. Supports free dragging with snap-to-step on release.

```tsx
// Basic continuous slider
<GlassSlider defaultValue={50} onChange={(v) => console.log(v)} />

// Controlled with label
<GlassSlider value={volume} onChange={setVolume} showLabel />

// Stepped (3 discrete positions, snaps on release)
<GlassSlider min={0} max={2} step={1} showLabel formatLabel={(v) => ["Low", "Mid", "High"][v]} />

// Disabled
<GlassSlider defaultValue={50} disabled />
```

**Props**: `value`, `defaultValue`, `onChange`, `min` (default: `0`), `max` (default: `100`), `step` (default: `1`), `disabled`, `showLabel`, `formatLabel`, `stepLabels`, `className`, `scale`

**Visual spec**:
- Track: `320×16px`, pill (`radius: 8px`), `bg: rgba(0,0,0,0.15)`, inset shadow, border shines
- Filled region: blue `rgba(48, 130, 246, 0.85)` with a convex-bezel specular linear-gradient
- Unfilled region: `rgba(148, 148, 159, 0.35)`, inset shadow
- Thumb: `56×44px` pill (`radius: 22px`)
  - At rest: `scale(0.65)`, opaque white `rgba(255,255,255,1)`, `shadow: 0 3px 14px rgba(0,0,0,0.3)`
  - Pressed: `scale(0.9)`, thumb bg fades to `rgba(255,255,255,0)` (fully transparent)
  - Travel accounts for visual width at rest scale (`56 × 0.65 = 36.4px`)
- Label: floating `<span>` above thumb, fades in on press

---

#### How Refraction Is Achieved

This is the most technically involved component in the library. It uses a **cloning technique** (not `backdrop-filter`) to achieve real refraction that works cross-browser.

##### Why not `backdrop-filter: url(#svgFilter)`?

Our earlier components (TactileSwitch, LiquidGlassWrap) use a generic pre-baked displacement map (`DISPLACEMENT_MAP` base64 JPEG) applied via `backdrop-filter: url(#filter)`. This approach has two problems:

1. **Browser support is fragile.** `backdrop-filter: url(#svg)` with displacement is only reliable in some Chrome builds. It silently renders as transparent in many environments. You often get the frosted blur but **no actual pixel refraction** — the content behind doesn't appear bent.
2. **The generic squircle map doesn't match arbitrary shapes.** A single pre-baked image can't adapt to different corner radii, bezel widths, or aspect ratios.

##### The Clone Technique (ported from kube.io)

Instead of filtering the backdrop, the slider **recreates the scene behind the thumb** inside the thumb itself, then applies `filter: url(#glassFilter)` as a regular CSS filter (which always works). The steps:

1. **Clone DOM layer** (`cloneRef`) lives inside the thumb, absolutely positioned, `filter: url(#thumb-filter)`, `opacity: 0` at rest.
2. **Clone inner** (`cloneInnerRef`) is a wide container (`TRACK_W × THUMB_H`) that holds re-rendered copies of:
   - Track background `rgba(0,0,0,0.15)`
   - Blue fill — width synced to real fill via CSS variable `--fill-w`
   - Unfilled region — `left` starts where fill ends
3. **Alignment transform**: as the thumb moves, `cloneInnerRef.style.transform = translate(${-(thumbX - THUMB_OFFSET)}px, 0)` shifts the clone content so it lines up pixel-perfectly with the real track behind the thumb.
4. **On press**, GSAP fades `cloneRef` opacity from `0 → 0.9` and thumb bg from `rgba(255,255,255,1) → rgba(255,255,255,0)`. The now-transparent thumb reveals the cloned scene, filtered through the glass displacement.
5. **On release**, the opacity animations reverse. Thumb becomes opaque white again.

##### Physics-Based Displacement Map Generation

`glass-map-generator.ts` generates the displacement map at runtime — not a pre-baked image. Key functions:

```typescript
generateGlassMaps({
  width: 56,              // thumb width
  height: 44,             // thumb height
  radius: 22,             // corner radius
  bezelWidth: 16,         // width of the refractive ring
  glassThickness: 80,     // optical thickness
  refractiveIndex: 1.45,  // glass IOR
})
// Returns: { displacementMap, specularMap, maxDisplacement }
```

The generator uses Snell's law ray tracing over a convex squircle surface `y = (1 - (1-x)^4)^(1/4)`:

1. **`calculateDisplacementMap1D`** — For 128 samples along the bezel radius, computes the surface normal via finite-difference derivative of the squircle profile, then applies `k = 1 - η²(1 - cosθ²)` (Snell's law) to get the refracted ray direction. The horizontal exit offset at the glass boundary is the displacement magnitude.
2. **`calculateDisplacementMap2D`** — Maps the 1D profile radially around a rounded rectangle. For each pixel inside the bezel ring, it looks up the 1D profile at the appropriate bezel depth and encodes the `(dX, dY)` vector as RGB values (`R = 128 + dX·127`, `G = 128 + dY·127`, 128 being neutral).
3. **`calculateSpecularHighlight`** — Generates a second `ImageData` containing a physically-motivated specular highlight based on a dot product with a fixed light direction (60°) and the surface curvature falloff.
4. Both `ImageData` objects are serialized to data URLs via `canvas.toDataURL()`.

##### The Composite SVG Filter

The generated displacement and specular maps are fed into a single SVG filter on the slider thumb. This filter chain produces both the warped refraction and the glossy specular:

```xml
<filter id="slider-thumb-{id}">
  <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="blurred_source" />

  <!-- Runtime-generated physics-based displacement map -->
  <feImage href="{displacementMap}" result="displacement_map" preserveAspectRatio="none" />

  <!-- Warp the source (the cloned track scene) using the map -->
  <feDisplacementMap in="blurred_source" in2="displacement_map"
                     scale="30" xChannelSelector="R" yChannelSelector="G"
                     result="displaced" />

  <!-- Color punch -->
  <feColorMatrix in="displaced" type="saturate" values="7" result="displaced_saturated" />

  <!-- Specular highlight -->
  <feImage href="{specularMap}" result="specular_layer" preserveAspectRatio="none" />
  <feComposite in="displaced_saturated" in2="specular_layer" operator="in" result="specular_saturated" />
  <feComponentTransfer in="specular_layer" result="specular_faded">
    <feFuncA type="linear" slope="0.4" />
  </feComponentTransfer>
  <feBlend in="specular_saturated" in2="displaced" mode="normal" result="withSaturation" />
  <feBlend in="specular_faded" in2="withSaturation" mode="normal" />
</filter>
```

Applied as `filter: url(#slider-thumb-{id})` (regular CSS filter, **not** `backdrop-filter`) to the clone layer. The filter operates on the clone's own DOM content, so it's deterministic — no browser dependence on `backdrop-filter` SVG URL support.

##### Summary Comparison

| Approach | Used by | Works in all browsers? | Real refraction? |
|---|---|---|---|
| `backdrop-filter: url(#svg)` + generic squircle map | LiquidGlassWrap, TactileSwitch thumb | Chrome-only, fragile | Partial (often missing) |
| Clone + physics-based runtime map + `filter: url(#svg)` | GlassSlider | Yes (regular CSS filter) | Yes, pixel-accurate |

The clone approach is more reliable but heavier (DOM duplication + runtime ImageData generation). Use it when real refraction is critical; use the backdrop-filter approach for smaller accents where a frosted look is acceptable.

---

**Interaction model**:

1. **Click on track**: thumb jumps to clicked position with elastic spring
2. **Drag**: press → thumb expands to glass mode, clone fades in, bg fades to transparent → free drag (thumb follows cursor exactly, no step snapping during drag) → release → snaps to nearest step with elastic spring → thumb bg restores, clone fades out
3. **Stepped mode**: drag freely, snap to closest discrete position on release

**GSAP animations**:
- Press expand: `scale → 0.9`, ease `back.out(1.4)`, 0.3s
- Press bg fade: `rgba(255,255,255,1) → rgba(255,255,255,0)`, ease `power2.out`, 0.25s
- Press clone fade-in: `opacity → 0.9`, ease `power2.out`, 0.25s
- Release shrink: `scale → 0.65`, ease `elastic.out(1, 0.7)`, 0.5s
- Release bg restore: `rgba(255,255,255,0) → 1`, ease `power2.out`, 0.35s
- Release clone fade-out: `opacity → 0`, ease `power2.out`, 0.35s
- Snap to step (on release): `x → snappedX`, ease `elastic.out(1, 0.6)`, 0.4s
- Track click jump: `x → targetX`, ease `elastic.out(1, 0.6)`, 0.5s
- External value change: `x → newX`, ease `elastic.out(1, 0.65)`, 0.4s
- Label show: `opacity → 1`, `y → -4`, ease `back.out(1.4)`, 0.2s
- Label hide: `opacity → 0`, `y → 0`, ease `power2.out`, 0.3s

---

## CSS Glass (Non-LiquidGlassWrap) Spec

For smaller elements where SVG displacement is unnecessary (switch thumbs, dock indicators, segment pills), use this CSS-only glass pattern:

```css
.css-glass {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.3),
    inset 0 1px 2px rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
}
```

For **recessed** elements (inputs, switch tracks):

```css
.css-glass-recessed {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px) saturate(140%);
}
```

---

## Animation Guidelines (GSAP)

All animations use GSAP. No CSS transitions for interactive states.

### Standard Eases

| Action | Ease | Duration |
|---|---|---|
| Hover enter | `back.out(1.7)` | 0.3s |
| Hover leave | `elastic.out(1, 0.5)` | 0.4s |
| Press down | `power2.out` | 0.15s |
| Press release | `elastic.out(1, 0.4)` | 0.4s |
| Slide (dock/segment) | `elastic.out(1, 0.65–0.7)` | 0.5s |
| Toggle (switch) | `elastic.out(1, 0.6)` | 0.5s |
| Scale punch | `elastic.out(1, 0.4)` | 0.4s |
| Menu open | `elastic.out(1, 0.6)` | 0.5s |
| Menu close | `power2.in` | 0.25s |
| Drag snap-back | `elastic.out(1, 0.5)` | 0.5s |

### Rules

1. **Hover**: Always scale slightly up (1.03–1.05) with `back.out`
2. **Press**: Always scale down (0.85–0.92) with `power2.out`, snap back with `elastic.out`
3. **Sliding elements**: Use `elastic.out` for rubber-band feel, add `scaleX` stretch (1.12–1.15) that springs back
4. **Toggle**: Combine position spring with scale punch on the moving element
5. **Keystroke**: Subtle axis-independent squeeze (`scaleX: 1.01, scaleY: 0.995`) that recovers in 0.3s

---

## Displacement Map

**File**: `src/components/glass/displacement-map.ts`

Exports `DISPLACEMENT_MAP` — a base64-encoded JPEG squircle displacement map extracted from the liquid-glass-react library. Each pixel encodes refraction direction:
- **R channel** → X displacement (128 = neutral)
- **B channel** → Y displacement (128 = neutral)
- Center is neutral gray (no displacement), edges encode outward refraction vectors following a squircle `y = (1-(1-x)^4)^(1/4)` surface profile.

Used by the SVG `feDisplacementMap` filter in `LiquidGlassWrap`.

---

## Browser Support

- **Chrome/Edge**: Full support (SVG filters in backdrop-filter)
- **Safari**: Backdrop blur/saturate works, but SVG displacement filter in `backdrop-filter` may not render — glass will appear frosted without edge refraction
- **Firefox**: Similar to Safari — frosted glass only, no displacement

The components are designed to degrade gracefully: even without refraction, the blur + border shine + shadows create a polished glass appearance.

---

## File Structure

```
src/components/glass/
  index.ts               — Barrel export for all components
  LiquidGlassWrap.tsx    — Core glass primitive (SVG filter + all layers)
  displacement-map.ts    — Base64 displacement map data
  GlassCard.tsx          — Draggable/static card
  GlassButton.tsx        — Pill button with spring animations
  TactileSwitch.tsx      — Toggle switch
  DragDock.tsx           — Navigation dock
  SegmentControl.tsx     — Tab switcher
  FluidInput.tsx         — Recessed input with keystroke animation
  GlassDropdown.tsx      — Dropdown select with frosted menu panel
  GlassModal.tsx         — Full-screen modal with glass backdrop and panel
  GlassFormField.tsx     — Labeled form input with glass styling
  GlassSlider.tsx        — Range slider with real refraction (clone technique + physics maps)
  glass-map-generator.ts — Runtime Snell's-law displacement + specular map generator
  LayeredFAB.tsx         — Expandable floating action button
```
