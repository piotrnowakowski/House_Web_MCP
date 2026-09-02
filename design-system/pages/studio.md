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

## Garden material system

- Realistic mode uses seven project-owned 1024 px material sources: meadow,
  maintained lawn, dormant winter grass, limestone gravel, mulch soil,
  limestone paving, and apple bark. Technical mode remains texture-free.
- Use mirrored repeat wrapping, mipmaps, and anisotropic filtering up to 8x to
  avoid visible seams and oblique-angle shimmer.
- Preserve believable physical scale: terrace slabs around 60 x 40 cm, gravel
  aggregate below 4 cm, lawn tiles around 4.8 m, and soil tiles around 1.8 m.
- Pair albedo with restrained bump and high roughness. Water alone may use
  strong clearcoat and low roughness.
- Keep turf and permeable paths nearly flush with terrain; terrace paving may
  sit about 10 cm proud. Never render garden zones as thick floating mats.
- Surface texture must not replace semantic feedback: selection and hover
  edges remain visible above every realistic material.
- Add small instanced grass/stone scatter and layered foliage only where it
  changes silhouette or close-range material reading.
