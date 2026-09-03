# Studio workspace override

This page-specific file overrides the generated master where the architectural
canvas requires a darker, lower-glare control surface. The warm lime selection
color is retained because it already maps to ghost variants and scene
selection; teal remains the keyboard-focus and hover color.

## Interaction tokens

| Token | Value | Usage |
| --- | --- | --- |
| `target-min` | `44px` | Minimum width and height for every canvas control |
| `control-gap` | `6-8px` | Prevent accidental adjacent activation |
| `snap-translation` | `0.5m` | Room, garden-zone, and plant movement |
| `snap-rotation` | `15deg` | Room rotation |
| `snap-scale` | `0.1` | Room scaling |
| `feedback-fast` | `~160ms` | Hover and active-state feedback |
| `toast-timeout` | `4.2s` | Non-blocking action confirmation |

## State colors

| Role | Value |
| --- | --- |
| Panel surface | `#101815` at 86-98% opacity |
| Control surface | `#1a2621` |
| Control hover | `#31453c` |
| Selection / primary action | `#c6ed76` |
| Hover / keyboard focus | `#2aa497` / `#8bd8c9` |
| Destructive action | `#6f3935` |
| Locked warning | `#e5a071` |

## Behavior rules

- Select rooms, garden zones, and plants directly in the scene; update the
  inspector in place without moving the camera.
- Attach transform controls to the selected object. Never render a gizmo at the
  scene origin as a proxy.
- Locked objects remain selectable for inspection but show no gizmo and expose
  visibly disabled edit controls.
- Keep critical actions available both as direct manipulation and as labelled
  canvas controls or keyboard shortcuts.
- Use `Escape` to close transient help and clear selection; use `?` to reveal
  the complete shortcut guide.
- Block clicks through panels and modals so they cannot select scene geometry.
- Disable all export controls while a file is being prepared and show an
  ellipsis on the active export.
- Respect `prefers-reduced-motion`; hover and lighting states may snap when it
  is enabled.

## Start screen

- The page opens on a modal start screen (`role="dialog"`, `aria-modal`, focus
  cycles inside, Escape returns from the terrain form or, once a project is
  active, closes the screen). It lists saved projects newest first with a small
  SVG outline of each plot, a lime **Continue · name** for the last active one,
  then two start cards: **Zielonki house study** (resets the bundled demo) and
  **New terrain** (a two-column form: name, width, depth, north, timezone,
  latitude, longitude, with inline field errors from the shared Zod schema).
- **Projects** in the top bar reopens the screen; "Keep working on …" closes it.
- Scene labels drawn with drei `Html` carry `zIndexRange={[9, 0]}` so panels
  (z 40 and up) and the start screen (z 70) always cover them.
- An empty plot shows an **Add a house** card in place of the house preset and
  "No buildings / walls / plants yet" in the model trees; the camera frames the
  site boundary when there is nothing else to look at.

## Material system

- The scene draws from a texture library of twelve Poly Haven CC0 scans shipped
  under `public/textures/` (about 21 MB), declared in `src/domain/textures.ts`
  with id, physical tile width and the surfaces it fits (wall, ground or both).
  Defaults follow the material or zone kind: red brick, hinoki and corrugated
  metal for brick, natural-timber and metal-panel walls; grass, concrete slabs,
  square tiles, brick pavement, mulch, soil and river pebbles for the seven zone
  kinds. Charred timber and light render stay flat by default.
- Every wall finish and every landscape zone can override its default through the
  thumbnail picker in the inspector ("Wall scan", "Ground scan") or through
  WebMCP (`list_catalog` textures, then `textureId` on a wall finish or a landscape
  `set-surface`). The choice is stored on the object as `textureId`; `none`
  means a flat colour, and an absent value keeps following the default.
- The scans a project draws load first and gate report captures; the rest of the
  library preloads in idle time so a later pick shows without a network wait.
- Textures tile at true physical scale from each scan's declared tile width.
  Ground polygons already carry metre UVs from ShapeGeometry; the geometry
  worker emits planar metre UVs for walls and slabs.
- Use mirrored repeat wrapping, mipmaps and anisotropic filtering up to 8x to
  avoid visible seams and oblique-angle shimmer. Diffuse maps are sRGB; normal
  and roughness maps are linear.
- The wall colour picker tints a textured finish 65 percent toward white, so the
  scan keeps most of its colour; the editor labels it "Tint over texture".
- Lawns turn to straw from November to March and read green from April to
  October, driven by the scene month.
- Surface texture must not replace semantic feedback: selection still turns a
  surface lime and ghost variants stay translucent above every material.
- Textures load behind a Suspense boundary with the flat colour as fallback, so
  a slow or failed load never blocks the canvas.
