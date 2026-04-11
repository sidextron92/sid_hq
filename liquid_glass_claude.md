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
| `--glass-bg` | `rgba(255,255,255,0.06)` | Glass surface base |
| `--glass-bg-hover` | `rgba(255,255,255,0.1)` | Glass hover state |
| `--glass-border` | `rgba(255,255,255,0.12)` | Glass border |
| `--glass-border-bright` | `rgba(255,255,255,0.25)` | Bright glass border |
| `--glass-shadow` | `0 10px 30px rgba(0,0,0,0.5)` | Standard elevation |
| `--glass-shadow-elevated` | `0 20px 40px rgba(0,0,0,0.6)` | Heavy elevation |
| `--glass-inset` | `inset 0 2px 4px rgba(255,255,255,0.15)` | Inset highlight |
| `--glass-inset-deep` | `inset 0 4px 10px rgba(0,0,0,0.5)` | Deep inset |
| `--glass-radius` | `24px` | Default radius |
| `--glass-radius-pill` | `100px` | Pill radius |

### Typography

- **Font**: Quicksand (Google Fonts), loaded via `next/font/google`
- **Weights**: 400 (body), 500 (medium), 600 (semibold), 700 (bold UI/headings)
- **Section labels**: `text-xs font-bold uppercase tracking-widest` in `rgba(255,255,255,0.7)` or `--text-muted`
- **CSS variable**: `--font-quicksand` (set by Next.js font loader)

### GSAP Animation Conventions

All interactive animations use GSAP. No CSS transitions for interactive states.

| Pattern | Scale | Easing | Duration |
|---|---|---|---|
| Hover enter | 1.03–1.05 | `back.out(1.7)` | 0.3s |
| Hover leave | 1 | `elastic.out(1, 0.5)` | 0.4s |
| Press down | 0.85–0.97 | `power2.out` | 0.1–0.15s |
| Release | spring back | `elastic.out(1, 0.4)` | 0.3–0.4s |
| Slides/toggles | — | `elastic.out(1, 0.6–0.7)` | 0.4–0.5s |
| Menu open | 0.85→1 | `elastic.out(1, 0.6)` | 0.4–0.5s |
| Menu close | →0.85 | `power2.in` | 0.2–0.25s |

---

## File: `src/components/glass/LiquidGlassWrap.tsx`

**Core Primitive** — The foundation of every glass element. A self-contained component with all layers inside a single `div`. Works in any layout context.

### Architecture (7 layers, bottom to top)

```
Layer 1: overLight tint      — black overlay (mix-blend: overlay, 15% opacity). Only renders when overLight=true.
Layer 2: Backdrop warp       — backdrop-filter: blur + saturate, with SVG displacement filter applied.
                                The SVG filter does chromatic aberration (R/G/B displaced at different scales)
                                using a pre-baked squircle displacement map (base64 JPEG from displacement-map.ts).
Layer 3: Hover highlight     — radial-gradient white glow following cursor (mix-blend: overlay).
                                Fades in on mouse enter, out on leave. Provides specular feedback.
Layer 4a: Color tint (normal)  — Colored fill (normal blend, 55% opacity). Visible on any background.
Layer 4b: Color tint (overlay) — Same color (mix-blend: overlay, 60% opacity). Depth interaction with backdrop.
                                 Both layers only render when tint is set.
Layer 5: Border shine (screen) — 1.5px edge highlight using mask-composite: xor trick.
                                  Linear gradient rotates with mouse position. mix-blend-mode: screen.
Layer 6: Border shine (overlay) — Same as Layer 5 but with mix-blend-mode: overlay for metallic sheen.
Layer 7: Content              — Your children, z-index: 1, with text-shadow for legibility.
```

### SVG Displacement Filter Details

- Uses `feDisplacementMap` on separate R/G/B channels at different scales:
  - Red: `scale`
  - Green: `scale + aberrationIntensity * 5`
  - Blue: `scale + aberrationIntensity * 10`
- Result blend mode: screen (RGB channels composited)
- Border shine gradient angle: `135° + mouseOffset.x * 1.2` (dynamic)

### Elasticity Behavior

- Activation zone: 200px from element center
- Directional stretch: `sx = 1 + normX*stretch*0.3 - normY*stretch*0.15`, `sy` inverse
- Translation: `tx = deltaX * elasticity * 0.1 * fade`, `ty` same
- Min scale clamp: 0.85
- Uses ResizeObserver for element measurement

### Behavior Notes

- **Text selection** disabled (`select-none`) on all glass elements. Override with `className="select-text"` on specific content.
- **Hover** triggers both the radial highlight glow (Layer 3) and the elasticity cursor-follow.
- Components with `elasticity > 0` need parent containers without `overflow: hidden` to avoid clipping the elastic transform.

### Props Reference

| Prop | Type | Default | Range | Description |
|---|---|---|---|---|
| `cornerRadius` | `number` | `32` | 0–999 | Border radius in px. Use 100+ for pill shapes. |
| `padding` | `string` | `"24px 28px"` | CSS | Content padding. |
| `displacementScale` | `number` | `100` | 0–200 | Refraction intensity. 0 = flat, 200 = extreme warp. |
| `blurAmount` | `number` | `5` | 0–40 | Frosting level in px. 0 = clear, 40 = opaque frost. |
| `saturation` | `number` | `140` | 100–300 | Backdrop color saturation %. |
| `aberrationIntensity` | `number` | `2` | 0–10 | Chromatic aberration. RGB separation at edges. |
| `elasticity` | `number` | `0.3` | 0–1 | Cursor-follow. Glass translates and stretches toward mouse. 0 = static. |
| `overLight` | `boolean` | `false` | — | Dark tint for bright backgrounds. Halves text-shadow. |
| `shadowIntensity` | `number` | `1` | 0–2 | Drop shadow depth. |
| `borderOpacity` | `number` | `1` | 0–1 | Border shine visibility. |
| `tint` | `string` | `undefined` | CSS color | Colored overlay, e.g. `rgba(99,102,241,0.3)`. |
| `onClick` | `() => void` | — | — | Makes element clickable (adds cursor: pointer). |

### Recommended Presets

```tsx
// Standard card (all defaults)
<LiquidGlassWrap />

// Pill button
<LiquidGlassWrap cornerRadius={100} padding="14px 28px" />

// Frosted panel (heavy blur, low refraction)
<LiquidGlassWrap blurAmount={35} displacementScale={30} saturation={120} />

// Clear lens (no blur, high refraction, strong aberration)
<LiquidGlassWrap blurAmount={0} displacementScale={150} aberrationIntensity={5} />

// Static (no cursor-follow, no hover highlight)
<LiquidGlassWrap elasticity={0} />

// Tinted glass
<LiquidGlassWrap tint="rgba(99, 102, 241, 0.3)" />

// For bright/wallpaper backgrounds
<LiquidGlassWrap overLight />
```

---

## File: `src/components/glass/GlassButton.tsx`

**Pill-Shaped Interactive Button** — Always `cornerRadius={100}`. Supports optional refractive clone technique.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | — | Button content |
| `onClick` | `() => void` | — | Click handler |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Size variant |
| `disabled` | `boolean` | — | Disables interactions |
| `tint` | `string` | — | Color tint passed to LiquidGlassWrap |
| `refractive` | `boolean` | — | Enable clone technique for optical refraction |
| `captureRef` | `RefObject<HTMLElement>` | — | DOM subtree to clone and refract |

### Size Map

| Size | Padding | Font Size |
|---|---|---|
| `sm` | `10px 20px` | `13px` |
| `md` | `14px 28px` | `15px` |
| `lg` | `18px 36px` | `17px` |

### GSAP Animations

- Hover enter: `scale: 1.05`, ease `back.out(1.7)`, 0.3s
- Hover leave: `scale: 1`, ease `elastic.out(1, 0.5)`, 0.4s
- Mouse down: `scale: 0.92`, ease `power2.out`, 0.15s
- Mouse up: `scale: 1.05`, ease `elastic.out(1, 0.4)`, 0.4s

### Refractive Mode

When `refractive` is enabled with a `captureRef`:
- Uses `generateGlassMaps()` to create physics-based displacement + specular maps
- Clones `captureRef` subtree, hides `data-refraction-ignore="true"` elements
- MutationObserver watches for content changes (excludes attribute mutations)
- Keeps clone aligned with captured anchor's bounding rect
- SVG filter: displacement scale 25, saturation 5

```tsx
<GlassButton onClick={handleClick}>Click me</GlassButton>
<GlassButton size="sm" tint="rgba(239, 68, 68, 0.35)">Delete</GlassButton>
<GlassButton size="lg" tint="rgba(99, 102, 241, 0.3)">Primary</GlassButton>
```

---

## File: `src/components/glass/GlassCard.tsx`

**Advanced Card** with optional drag support and refractive clone technique. Uses `LiquidGlassWrap` internally.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | — | Card content |
| `draggable` | `boolean` | — | Enable drag behavior |
| `refractive` | `boolean` | — | Enable optical refraction |
| `renderScene` | `() => ReactNode` | — | Scene JSX to refract |
| `sceneSize` | `{width, height}` | — | Scene dimensions |
| `sceneRef` | `RefObject<HTMLElement>` | — | Real scene container ref |
| `captureRef` | `RefObject<HTMLElement>` | — | DOM subtree to clone and refract |
| `cornerRadius` | `number` | — | Passed to LiquidGlassWrap |
| `padding` | `string` | — | Passed to LiquidGlassWrap |
| `blurAmount` | `number` | — | Passed to LiquidGlassWrap |
| `saturation` | `number` | — | Passed to LiquidGlassWrap |
| `elasticity` | `number` | — | Passed to LiquidGlassWrap |
| `className` | `string` | — | Additional classes |
| `style` | `CSSProperties` | — | Additional styles |

### Drag Behavior (GSAP)

- Pointer down: `scale: 1.03`, ease `back.out(1.7)`, 0.3s
- During drag: incremental `x/y` translation
- Pointer up: `scale: 1`, ease `elastic.out(1, 0.5)`, 0.5s

### Refractive Clone Path

Same clone technique as GlassSlider/GlassButton:
- Clones `captureRef` subtree, hides `data-refraction-ignore="true"` elements
- MutationObserver (skips attributes) re-clones on DOM changes
- SVG filter: displacement scale 30, saturation 4

```tsx
<GlassCard>Static content</GlassCard>
<GlassCard draggable>Drag me around</GlassCard>
<GlassCard cornerRadius={16} padding="16px 20px">Compact card</GlassCard>
```

---

## File: `src/components/glass/TactileSwitch.tsx`

**Liquid Glass Toggle Switch** — Inspired by kube.io. The thumb is deliberately larger than the track and uses SVG displacement for the glass effect. Toggle commits on release, not press.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `checked` | `boolean` | — | Controlled state |
| `onChange` | `(checked: boolean) => void` | — | Change handler |
| `disabled` | `boolean` | — | Disables interactions |
| `scale` | `number` | `1` | Visual scale factor |

### Visual Spec

- **Track**: `160x67px`, radius `33.5px`
  - OFF: `rgba(148, 148, 159, 0.47)` (gray)
  - ON: `rgba(59, 191, 78, 0.93)` (green)
- **Thumb**: `146x92px`, radius `46px`
  - At rest: `scale(0.65)`, `rgba(255,255,255,1)`, `shadow: 0 4px 22px rgba(0,0,0,0.1)`
  - Pressed (glass mode): `scale(0.9)`, `rgba(255,255,255,0.1)` — track shows through
  - SVG displacement filter with squircle map, `feColorMatrix saturate(6)`
  - Border shines: screen + overlay gradient masks
- **Travel**: `57.9px`
- **Margin-left**: `-22px` (centers oversized thumb on track)

### Clone Technique

- Recreates track scene inside thumb at rest
- On press, thumb bg fades to transparent, clone opacity fades to 0.9
- Clone inner transform keeps track pinned as thumb moves
- Cloned track color synced via real-time interpolation during drag

### Interaction Model (3 modes)

1. **Tap**: press -> expand to glass -> release -> toggle, slide to opposite side
2. **Drag**: press -> expand -> drag (0-57.9px clamped) -> track color interpolates -> release -> snap to closest side (>50%)
3. **Hold**: press -> stay expanded -> release triggers toggle

### GSAP Animations

- Press expand: `scale -> 0.9`, ease `back.out(1.4)`, 0.3s
- Press bg fade: `rgba(255,255,255,1) -> 0.1`, ease `power2.out`, 0.25s
- Release slide: `x -> 0 or 57.9`, `scale -> 0.65`, ease `elastic.out(1, 0.7)`, 0.5s
- Release bg restore: `rgba(255,255,255,0.1) -> 1`, ease `power2.out`, 0.35s
- Track color: ease `power2.out`, 0.4s (or real-time during drag)
- Dead zone: 4px before drag recognized

---

## File: `src/components/glass/GlassSlider.tsx`

**Range Slider with True Optical Refraction** — Inspired by kube.io. Most technically involved component. Uses **cloning technique** (not `backdrop-filter`) for real cross-browser refraction via Snell's law displacement.

**Depends on**: `glass-map-generator.ts` (runtime physics-based displacement maps)

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `number` | — | Controlled value |
| `defaultValue` | `number` | — | Uncontrolled initial value |
| `onChange` | `(value: number) => void` | — | Change handler |
| `min` | `number` | `0` | Minimum value |
| `max` | `number` | `100` | Maximum value |
| `step` | `number` | `1` | Step increment |
| `disabled` | `boolean` | — | Disables interactions |
| `showLabel` | `boolean` | — | Floating label with current value |
| `formatLabel` | `(value: number) => string` | — | Custom label formatting |
| `stepLabels` | `string[]` | — | Labels at step positions |
| `scale` | `number` | `1` | Visual scale factor |

### Visual Spec

- **Track**: `320x16px`, pill (radius `8px`), `bg: rgba(0,0,0,0.15)`, inset shadow, border shines
- **Filled region**: blue `rgba(48, 130, 246, 0.85)` with convex-bezel specular gradient
- **Unfilled region**: `rgba(148, 148, 159, 0.35)`, inset shadow
- **Thumb**: `56x44px` pill (radius `22px`)
  - At rest: `scale(0.65)`, `rgba(255,255,255,1)`, `shadow: 0 3px 14px rgba(0,0,0,0.3)`
  - Pressed: `scale(0.9)`, bg fades to `rgba(255,255,255,0)` (fully transparent)
  - Travel: `TRACK_W - (THUMB_W * 0.65) = 283px`
- **Label**: floating `<span>` above thumb, fades in on press

### Clone Technique (Refraction)

**Why not `backdrop-filter: url(#svgFilter)`?**
1. Browser support fragile — `backdrop-filter: url(#svg)` with displacement only reliable in some Chrome builds
2. Generic squircle map doesn't adapt to different shapes/aspect ratios

**The approach:**
1. Clone DOM layer inside thumb with `filter: url(#thumb-filter)`, `opacity: 0` at rest
2. Clone inner holds re-rendered copies of track bg, blue fill, unfilled region
3. Fill width synced via CSS variable `--fill-w`
4. Alignment: `translate(${-(thumbX - THUMB_OFFSET)}px, 0)` keeps clone pixel-aligned with real track
5. On press: fade clone opacity `0->0.9`, thumb bg `1->0`. Transparent thumb reveals filtered clone
6. On release: reverse

### Physics-Based Map Generation (`glass-map-generator.ts`)

```typescript
generateGlassMaps({
  width: 56, height: 44, radius: 22,
  bezelWidth: 16, glassThickness: 80, refractiveIndex: 1.45,
})
// Returns: { displacementMap, specularMap, maxDisplacement }
```

- Snell's law ray tracing over convex squircle surface `y = (1 - (1-x)^4)^(1/4)`
- `calculateDisplacementMap1D`: 128 samples, surface normal via finite-difference, Snell's law refraction
- `calculateDisplacementMap2D`: Maps 1D radially around rounded rect, encodes `(dX, dY)` as RGB
- `calculateSpecularHighlight`: Dot product with light direction (60deg), curvature falloff
- Both serialized to data URLs via `canvas.toDataURL()`

### SVG Filter Chain

```xml
<filter id="slider-thumb-{id}">
  <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="blurred_source" />
  <feImage href="{displacementMap}" result="displacement_map" preserveAspectRatio="none" />
  <feDisplacementMap in="blurred_source" in2="displacement_map"
                     scale="30" xChannelSelector="R" yChannelSelector="G" result="displaced" />
  <feColorMatrix in="displaced" type="saturate" values="7" result="displaced_saturated" />
  <feImage href="{specularMap}" result="specular_layer" preserveAspectRatio="none" />
  <feComposite in="displaced_saturated" in2="specular_layer" operator="in" result="specular_saturated" />
  <feComponentTransfer in="specular_layer" result="specular_faded">
    <feFuncA type="linear" slope="0.4" />
  </feComponentTransfer>
  <feBlend in="specular_saturated" in2="displaced" mode="normal" result="withSaturation" />
  <feBlend in="specular_faded" in2="withSaturation" mode="normal" />
</filter>
```

Applied as `filter: url(#slider-thumb-{id})` (regular CSS filter, **not** `backdrop-filter`).

### GSAP Animations

- Press expand: `scale -> 0.9`, ease `back.out(1.4)`, 0.3s
- Press bg fade: `rgba(255,255,255,1) -> 0`, ease `power2.out`, 0.25s
- Press clone fade: `opacity -> 0.9`, ease `power2.out`, 0.25s
- Release shrink: `scale -> 0.65`, ease `elastic.out(1, 0.7)`, 0.5s
- Release bg restore: `-> 1`, ease `power2.out`, 0.35s
- Release clone fade: `opacity -> 0`, ease `power2.out`, 0.35s
- Snap to step: `x -> snappedX`, ease `elastic.out(1, 0.6)`, 0.4s
- Track click jump: `x -> targetX`, ease `elastic.out(1, 0.6)`, 0.5s
- External value change: `x -> newX`, ease `elastic.out(1, 0.65)`, 0.4s

```tsx
<GlassSlider defaultValue={50} onChange={(v) => console.log(v)} />
<GlassSlider value={volume} onChange={setVolume} showLabel />
<GlassSlider min={0} max={2} step={1} showLabel formatLabel={(v) => ["Low", "Mid", "High"][v]} />
```

---

## File: `src/components/glass/GlassFormField.tsx`

**Labeled Form Input Field** — Rounded-rect shape (not pill). Includes label, no icon.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | — | Label text above input |
| `placeholder` | `string` | — | Input placeholder |
| `value` | `string` | — | Controlled value |
| `onChange` | `(value: string) => void` | — | Change handler |
| `onKeyDown` | `(e: KeyboardEvent) => void` | — | Keydown handler |
| `type` | `string` | `"text"` | Input type |

### Visual Spec

- **Label**: `text-xs font-bold uppercase tracking-widest`, `rgba(255,255,255,0.7)`
- **Input wrapper**: `LiquidGlassWrap` with `cornerRadius: 16`, `blurAmount: 8`, `displacementScale: 80`, `elasticity: 0.15`
- **Border shine**: `0.6` default, `1.0` on focus
- **Shadow**: `0.5` default, `0.8` on focus
- **Text**: `15px`, `rgba(255,255,255,0.85)`, `text-shadow: 0 1px 4px rgba(0,0,0,0.5)`
- **Input padding**: `14px 18px`
- **Input**: `select-text` class (overrides glass `select-none`)

### GSAP Animations

- Focus: `scale: 1.02`, ease `elastic.out(1, 0.6)`, 0.4s
- Blur: `scale: 1`, ease `elastic.out(1, 0.5)`, 0.4s
- Mouse down: `scale: 0.97`, ease `power2.out`, 0.12s
- Mouse up: spring back to `1.02` (if focused) or `1`, 0.4s
- Keystroke: `scaleX: 1.006, scaleY: 0.997` (0.06s), snap back in 0.25s

```tsx
<GlassFormField label="Name" placeholder="Enter your name..." value={name} onChange={setName} />
<GlassFormField label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
```

---

## File: `src/components/glass/FluidInput.tsx`

**Liquid Glass Search/Input Field** — Inspired by kube.io. Pill shape with built-in icon.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `placeholder` | `string` | — | Placeholder text |
| `value` | `string` | — | Controlled value |
| `onChange` | `(value: string) => void` | — | Change handler |
| `type` | `string` | `"search"` | Input type |
| `icon` | `ReactNode` | Built-in search icon | Custom icon |
| `width` | `number` | `320` | Input width in px |

### Visual Spec

- **Dimensions**: `{width}x42px`, fully rounded (`border-radius: 21px`)
- **Uses**: `LiquidGlassWrap` with `blurAmount: 8`, `displacementScale: 80`, `elasticity: 0.15`
- **Built-in icon**: Ionicons search SVG, `20px`, `50%` opacity
- **Layout**: `flex, gap: 12px, padding: 0 14px`
- **Text**: `16px`, `rgba(255,255,255,0.8)`, `text-shadow: 0 1px 4px rgba(0,0,0,0.5)`
- **Placeholder**: `rgba(255,255,255,0.35)` (set in `globals.css`)
- **Border shine**: `0.6` default, `1.0` on focus
- **Shadow**: `0.5` default, `0.8` on focus

### GSAP Animations

- Focus: `scale: 1.02`, ease `elastic.out(1, 0.6)`, 0.4s
- Blur: `scale: 1`, ease `elastic.out(1, 0.5)`, 0.4s
- Mouse down: `scale: 0.96`, ease `power2.out`, 0.12s
- Mouse up: spring back to `1.02` (if focused) or `1`, 0.4s
- Keystroke: `scaleX: 1.008, scaleY: 0.996` (0.06s), snap back in 0.25s

```tsx
<FluidInput placeholder="Search tasks..." value={query} onChange={setQuery} />
<FluidInput icon={<MyIcon />} width={400} placeholder="Filter..." />
```

---

## File: `src/components/glass/GlassModal.tsx`

**Full-Screen Modal Overlay** with frosted glass backdrop and glass panel. Closes on backdrop click or Escape.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | — | Modal content |
| `open` | `boolean` | — | Controls visibility |
| `onClose` | `() => void` | — | Close handler |
| `width` | `number` | `420` | Panel width in px |

### Visual Spec

- **Backdrop**: `rgba(0, 0, 0, 0.2)`, `backdrop-filter: blur(4px) saturate(120%)`
- **Panel**: `LiquidGlassWrap` with `cornerRadius: 24`, `blurAmount: 25`, `displacementScale: 60`, `saturation: 160`, `shadowIntensity: 1.8`, `elasticity: 0`
- **Close button**: top-right `32px` circle, `rgba(255,255,255,0.08)` bg, hover brightens to `0.15`
- **Content area**: `padding: 32px`, scrollable with `max-height: calc(100vh - 96px)`

### GSAP Animations

- Backdrop fade in: `opacity: 0->1`, ease `power2.out`, 0.3s
- Panel open: `scale: 0.85->1`, `y: 20->0`, `opacity: 0->1`, ease `elastic.out(1, 0.6)`, 0.5s
- Panel close: `scale->0.85`, `y->20`, `opacity->0`, ease `power2.in`, 0.25s
- Backdrop fade out: `opacity->0`, ease `power2.in`, 0.25s

```tsx
<GlassModal open={isOpen} onClose={() => setIsOpen(false)}>
  <h2>Title</h2>
  <p>Content</p>
</GlassModal>
<GlassModal open={isOpen} onClose={handleClose} width={360}>...</GlassModal>
```

---

## File: `src/components/glass/GlassDropdown.tsx`

**Pill-Shaped Dropdown** with frosted glass menu panel. Closes on outside click or Escape.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `{id, label, icon?, disabled?}[]` | — | Menu options |
| `value` | `string` | — | Selected option id |
| `placeholder` | `string` | — | Placeholder text |
| `onChange` | `(option) => void` | — | Selection handler |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Size variant |
| `disabled` | `boolean` | — | Disables interactions |
| `width` | `number` | `240` | Dropdown width in px |

### Size Map

| Size | Padding | Font Size | Icon Size |
|---|---|---|---|
| `sm` | `10px 16px` | `13px` | `16px` |
| `md` | `14px 20px` | `15px` | `18px` |
| `lg` | `18px 24px` | `17px` | `20px` |

### Visual Spec

- **Trigger**: pill (`cornerRadius: 100`), `LiquidGlassWrap` with `blurAmount: 8`, `displacementScale: 80`, `elasticity: 0.15`
  - Chevron rotates 180deg on open
  - Selected label in `--text-main`, placeholder in `--text-muted`
- **Menu panel**: `LiquidGlassWrap` with `blurAmount: 80`, `displacementScale: 60`, `saturation: 160`, `cornerRadius: 20`, `shadowIntensity: 1.5`, `elasticity: 0`, `tint: rgba(0, 0, 0, 0.8)`
  - Positioned below trigger (`mt-2`), full width
- **Option rows**: transparent bg, `border: 1px solid rgba(255,255,255,0.08)`, inset shadow
  - Selected: `rgba(255,255,255,0.1)` bg with checkmark
  - Optional icon: `32px` circle with border
  - `rounded-2xl` corners

### GSAP Animations

- Trigger hover: `scale -> 1.03`, ease `back.out(1.7)`, 0.3s
- Trigger leave: `scale -> 1`, ease `elastic.out(1, 0.5)`, 0.4s
- Trigger press: `scale -> 0.96`, ease `power2.out`, 0.15s
- Trigger release: `scale -> 1.03`, ease `elastic.out(1, 0.4)`, 0.4s
- Menu open: `scale: 0.85->1`, `y: -4->0`, `opacity: 0->1`, ease `elastic.out(1, 0.6)`, 0.4s
- Menu close: `scale->0.85`, `y->-4`, `opacity->0`, ease `power2.in`, 0.2s
- Chevron: `0->180deg` / `180->0deg`, ease `back.out(1.7)`, 0.3s
- Item stagger: `opacity: 0->1`, `x: -8->0`, ease `power2.out`, 0.3s, stagger `0.035s`
- Item hover: `x -> 4`, ease `power2.out`, 0.25s
- Item leave: `x -> 0`, ease `elastic.out(1, 0.5)`, 0.3s
- Item press: `scale -> 0.97`, 0.1s; release: `scale -> 1`, 0.3s
- Selection punch: trigger `scale: 0.96->1`, ease `elastic.out(1, 0.4)`, 0.4s

```tsx
<GlassDropdown
  options={[
    { id: "board", label: "Board View", icon: <BoardIcon /> },
    { id: "list", label: "List View" },
  ]}
  value={view}
  placeholder="Select view..."
  onChange={(opt) => setView(opt.id)}
/>
```

---

## File: `src/components/glass/SegmentControl.tsx`

**Tab Switcher** with rubber-band stretching glass indicator.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `segments` | `string[]` | — | Tab labels |
| `activeIndex` | `number` | — | Active tab index |
| `onChange` | `(index, label) => void` | — | Selection handler |

### Visual Spec

- **Container**: `bg: rgba(0,0,0,0.3)`, pill shape, `inset shadow: 0 2px 6px rgba(0,0,0,0.3)`
- **Indicator**: CSS glass — `bg: rgba(255,255,255,0.08)`, `border: 1px solid rgba(255,255,255,0.15)`, `backdrop-filter: blur(12px) saturate(140%)`, pill shape
- **Each segment**: `min-width: 80px`, `padding: 10px 24px`, `font: 14px bold`
- Active: `opacity: 1`, inactive: `opacity: 0.5`

### GSAP Animations

- Position: ease `elastic.out(1, 0.65)`, 0.5s
- Stretch: `scaleX: 1.15->1`, ease `elastic.out(1, 0.5)`, 0.4s

```tsx
<SegmentControl segments={["Login", "Sign Up"]} activeIndex={0} onChange={(i) => setMode(i)} />
```

---

## File: `src/components/glass/DragDock.tsx`

**Navigation Dock** with sliding glass indicator behind the active item.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `{id, label, icon}[]` | — | Dock items |
| `activeId` | `string` | — | Active item id |
| `onSelect` | `(id: string) => void` | — | Selection handler |
| `direction` | `"horizontal" \| "vertical"` | `"horizontal"` | Layout direction |

### Visual Spec

- **Container**: `bg: rgba(0,0,0,0.35)`, `border: 1px solid rgba(255,255,255,0.08)`, `radius: 20px`
- **Indicator**: CSS glass, rounded, with backdrop blur
- **Active icon**: `scale(1.15) translateY(-1px)`, `drop-shadow(0 0 6px rgba(255,255,255,0.35))`

### GSAP Animations

- Position: ease `elastic.out(1, 0.7)`, 0.5s
- Stretch: `scaleX/scaleY: 1.12->1`, ease `elastic.out(1, 0.5)`, 0.4s

```tsx
<DragDock
  items={[{ id: "home", label: "Home", icon: <HomeIcon /> }]}
  activeId="home"
  onSelect={(id) => setActive(id)}
/>
```

---

## File: `src/components/glass/LayeredFAB.tsx`

**Draggable Floating Action Button** — Magnifying-glass-style capsule inspired by kube.io. Fixed-positioned bottom-right.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `actions` | `{id, label, icon, onClick}[]` | — | Menu action items |

### Visual Spec

- **Capsule**: `160x120px`, `radius: 65px` (pill/capsule)
  - `LiquidGlassWrap` with `blurAmount: 5`, `displacementScale: 100`, `saturation: 140`, `elasticity: 0.3`, `shadowIntensity: 1.2`
- **Icon**: `+` (28px SVG), white with drop-shadow, rotates 45deg to `x` on open
- **Menu panel**: `LiquidGlassWrap` with `blurAmount: 12`, `displacementScale: 60`, `cornerRadius: 20`, `shadowIntensity: 1.5`
  - Positioned above capsule (`bottom: 100%, mb-3`)
  - Action items: `40px` icon circles, `border: 1.5px solid rgba(255,255,255,0.2)`, hover `bg: rgba(255,255,255,0.1)`
- **Position**: `fixed bottom-8 right-8 z-50`

### Interaction Model (3 modes)

1. **Tap**: press -> scale up to `1.05` -> release -> menu toggles
2. **Drag**: press -> scale up -> drag freely -> velocity-based `scaleX` squish (`min: 0.8`) -> release -> restore
3. **Hover**: elasticity + radial glow from LiquidGlassWrap

**Important**: No `scaleY` animations on the capsule. Elasticity handles directional stretch — adding GSAP `scaleY` would conflict.

### GSAP Animations

- Press: `scale -> 1.05`, ease `elastic.out(1, 0.6)`, 0.4s
- Release: `scaleX -> 1`, `scale -> 1`, ease `elastic.out(1, 0.6)`, 0.5s
- Drag squish: `scaleX = max(0.8, 1 - |velocity| / 4000)` per frame
- Menu open: `scale: 0.4->1`, `y: 10->0`, `opacity: 0->1`, ease `elastic.out(1, 0.6)`, 0.5s
- Menu close: `scale->0.4`, `y->10`, `opacity->0`, ease `power2.in`, 0.25s
- Icon rotation: `0->45deg` / `45->0deg`, ease `back.out(1.7)`, 0.3s
- Dead zone: 4px before drag recognized

```tsx
<LayeredFAB actions={[
  { id: "add", label: "New Task", icon: <PlusIcon />, onClick: handleAdd },
]} />
```

---

## File: `src/components/glass/glass-map-generator.ts`

**Runtime Physics-Based Displacement Map Generator** — Generates displacement and specular maps at runtime using Snell's law ray tracing. Not a pre-baked image.

### API

```typescript
generateGlassMaps(options: {
  width: number;        // element width
  height: number;       // element height
  radius: number;       // corner radius
  bezelWidth: number;   // width of refractive ring
  glassThickness: number; // optical thickness
  refractiveIndex: number; // glass IOR (default ~1.45)
}) => {
  displacementMap: string;  // data URL
  specularMap: string;      // data URL
  maxDisplacement: number;
}
```

### Internal Functions

- `calculateDisplacementMap1D`: 128 samples along bezel radius, surface normal via finite-difference derivative of squircle `y = (1 - (1-x)^4)^(1/4)`, Snell's law refraction
- `calculateDisplacementMap2D`: Maps 1D radially around rounded rect, encodes `(dX, dY)` as RGB (`R = 128 + dX*127`, `G = 128 + dY*127`)
- `calculateSpecularHighlight`: Dot product with light direction (60deg), curvature falloff

### Used By

- `GlassSlider` — thumb refraction (scale 30, saturation 7)
- `GlassButton` — refractive mode (scale 25, saturation 5)
- `GlassCard` — refractive mode (scale 30, saturation 4)

---

## File: `src/components/glass/displacement-map.ts`

**Pre-baked Squircle Displacement Map** — Base64 JPEG constant `DISPLACEMENT_MAP`. Used by `LiquidGlassWrap` for the generic `backdrop-filter: url(#svg)` approach. Single-image, not shape-adaptive.

### Used By

- `LiquidGlassWrap` (Layer 2 backdrop warp)

---

## File: `src/components/glass/index.ts`

**Barrel Export** — All 12 glass components:

```typescript
export { default as LiquidGlassWrap } from "./LiquidGlassWrap";
export { default as GlassCard } from "./GlassCard";
export { default as GlassButton } from "./GlassButton";
export { default as TactileSwitch } from "./TactileSwitch";
export { default as DragDock } from "./DragDock";
export { default as SegmentControl } from "./SegmentControl";
export { default as FluidInput } from "./FluidInput";
export { default as LayeredFAB } from "./LayeredFAB";
export { default as GlassDropdown } from "./GlassDropdown";
export { default as GlassModal } from "./GlassModal";
export { default as GlassFormField } from "./GlassFormField";
export { default as GlassSlider } from "./GlassSlider";
```

Import: `import { GlassButton, GlassCard } from "@/components/glass"`

---

## File: `src/components/RainOverlay.tsx`

**Canvas-Based Rain Animation** with collision-driven splatter particles. Not a glass component — standalone canvas overlay.

### Props / Config

```typescript
interface RainConfig {
  intensity: 1 | 2 | 3;    // drop count: 40 to 200
  wind: number;             // -1 to 1 (angle offset)
  opacity: number;          // 0 to 1
  speed: 1 | 2 | 3;        // preset speed ranges
  splatterSize: number;
  splatterParticleCount: number;
}
```

### Features

- Device pixel ratio scaling
- Collision detection with card bounding rects
- Splatter creation on card hit (60-90% chance based on intensity)
- Frame-by-frame `requestAnimationFrame` animation
- Particle decay with exponential falloff

---

## Refraction Techniques Comparison

| Technique | Used By | Browser Support | Real Refraction? |
|---|---|---|---|
| `backdrop-filter: url(#svg)` + pre-baked squircle map | LiquidGlassWrap | Chrome-only, fragile | Partial (often missing) |
| Clone + physics-based runtime map + `filter: url(#svg)` | GlassSlider, GlassButton (refractive), GlassCard (refractive), TactileSwitch | All browsers | Yes, pixel-accurate |

The clone approach is more reliable but heavier (DOM duplication + runtime ImageData generation). Use it when real refraction is critical; use the backdrop-filter approach for smaller accents where a frosted look is acceptable.

---

## Usage in Kanban Board (`src/app/page.tsx`)

### Glass Components Used

| Component | Where | Count | Configuration |
|---|---|---|---|
| `LiquidGlassWrap` | Column headers | 4 | `cornerRadius: 14, blurAmount: 12, displacementScale: 40, elasticity: 0, shadowIntensity: 0.5` |
| `LiquidGlassWrap` | Task cards | N | `cornerRadius: 16, blurAmount: 6, displacementScale: 60, overLight, elasticity: 0.2, shadowIntensity: 0.8` |
| `GlassButton` | Rain settings toggle | 1 | `size="sm"`, conditional `tint="rgba(99, 162, 241, 0.3)"` |
| `GlassButton` | Add Task | 1 | `size="md"`, default |
| `GlassButton` | Logout | 1 | `size="sm"`, default |
| `GlassButton` | Modal actions (Delete, Cancel, Save) | 3 | `size="sm"`, various tints |
| `GlassModal` | Task create/edit | 1 | `width: 420` (default) |
| `GlassModal` | Rain settings | 1 | `width: 360` |
| `GlassFormField` | Task title input | 1 | In task modal |
| `GlassFormField` | Tag input | 1 | In task modal, with `onKeyDown` |
| `TactileSwitch` | Rain on/off toggle | 1 | `scale: 0.5` |
| `GlassSlider` | Rain intensity | 1 | `min: 1, max: 3, step: 1, showLabel, formatLabel, scale: 0.9` |
| `GlassSlider` | Rain wind | 1 | `min: -1, max: 1, step: 0.1, showLabel, formatLabel, scale: 0.9` |
| `GlassSlider` | Rain opacity | 1 | `showLabel, formatLabel, scale: 0.9` |
| `GlassSlider` | Splatter particles | 1 | `showLabel, scale: 0.9` |

### Inline Elements (NOT using glass components)

These elements are styled inline without glass components — they are layout containers, not glass surfaces:

| Element | Styling | Why not a glass component? |
|---|---|---|
| Column container | `border: 1px solid rgba(255,255,255,0.06)`, `bg: rgba(0,0,0,0.1)`, `rounded-2xl` | Layout container, not a glass surface |
| Header title | `text-xl font-black` | Plain text, no glass needed |
| Header button row | `flex gap-2` | Layout container |
| Task count badge | `bg: rgba(255,255,255,0.1)`, small text | Tiny accent, not worth a component |
| Tag pills | `bg: hexToRgba(tag.color, 0.35)`, `border: rgba(255,255,255,0.12)` | Inline pill styling, too simple for glass |
| Drop indicator | `bg: rgba(99,102,241,0.08)`, `border: 2px dashed rgba(99,102,241,0.25)` | Ephemeral drag state indicator |

### Kanban-Specific GSAP Animations (Not in component library)

| Animation | Trigger | Values |
|---|---|---|
| Card lift | Drag start | `scale: 1.05`, ease `back.out(1.7)`, 0.3s |
| FLIP drop | Drag end | `fromTo({x: dx, y: dy, scale: 1.05}, {x: 0, y: 0, scale: 1})`, 0.4s, `power2.out` |
| Column highlight | Drag over column | `boxShadow: inset 0 0 40px rgba(99,102,241,0.12)`, `borderColor: rgba(99,102,241,0.35)`, `scale: 1.015`, 0.3s |
| Column unhighlight | Drag leave | Reset to defaults, 0.3s |

### Drag-and-Drop Implementation

Custom pointer-event-based (no library). Key patterns:
- Mutable refs during drag to avoid React re-renders
- Card positioned `fixed` during drag to escape `overflow:hidden` containers
- Placeholder div preserves original card space
- FLIP animation on drop for smooth transition back to DOM position
- Drop target calculated by pointer position against column/card bounds

---

## Usage in Login Page (`src/app/login/page.tsx`)

### Glass Components Used

| Component | Where | Count | Configuration |
|---|---|---|---|
| `LiquidGlassWrap` | Main modal card | 1 | `cornerRadius: 24, padding: "0", blurAmount: 25, displacementScale: 60, saturation: 160, shadowIntensity: 1.8, elasticity: 0` |
| `SegmentControl` | Login/Sign Up mode toggle | 1 | `segments: ["Login", "Sign Up"]` |
| `GlassFormField` | Email, Password, Name, OTP | 2-3 per mode | Various `type` and `label` values |
| `GlassButton` | Sign In, Create Account, Verify, Back | 1-2 per mode | `size="md"` or `size="sm"`, indigo tint for primary |

### Inline Elements

| Element | Styling |
|---|---|
| Video background | `<video>` with `autoPlay, loop, muted, playsInline`, `object-cover` |
| Dim overlay | `bg: rgba(0,0,0,0.3)` over video |
| Success message | `color: #4ade80`, text-shadow |
| Error message | `color: #f87171`, text-shadow |
| OTP instruction | `rgba(255,255,255,0.7)`, bold email |

---

## Components NOT Used in App (Library-Only)

These components are exported from the barrel but not currently used in either the kanban board or login page:

| Component | Purpose | Notes |
|---|---|---|
| `GlassCard` | Draggable/refractive card | Kanban uses `LiquidGlassWrap` directly for task cards |
| `FluidInput` | Search/input with icon | Kanban uses `GlassFormField` instead |
| `GlassDropdown` | Dropdown menu | No dropdown UI in current app |
| `DragDock` | Navigation dock | No navigation dock in current app |
| `LayeredFAB` | Floating action button | No FAB in current app |

### Key Difference: GlassCard vs Kanban Task Cards

The kanban board does **not** use `GlassCard` for task cards. Instead, it wraps a plain `<div>` with `LiquidGlassWrap` directly:

```tsx
// Kanban board (page.tsx) — uses LiquidGlassWrap directly
<div onPointerDown={handleCardPointerDown} style={{cursor: "grab"}}>
  <LiquidGlassWrap cornerRadius={16} padding="14px 16px" blurAmount={6}
    displacementScale={60} overLight elasticity={0.2} shadowIntensity={0.8}>
    <TaskCardContent task={task} tagMap={tagMap} />
  </LiquidGlassWrap>
</div>

// GlassCard component — adds drag support + optional refraction
<GlassCard draggable>Content</GlassCard>
```

**Why?** The kanban board has its own custom drag-and-drop system using `fixed` positioning, placeholders, and FLIP animations. `GlassCard`'s built-in drag uses simpler incremental translation. The kanban's drag needs to escape `overflow:hidden` column containers and calculate drop targets across columns — requirements beyond what `GlassCard.draggable` provides.
