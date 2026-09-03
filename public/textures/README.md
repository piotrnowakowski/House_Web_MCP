# Texture sources

All material scans in this folder come from [Poly Haven](https://polyhaven.com) and are released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain). Attribution is not
required by the licence; it is given here because the scans deserve it.

| Folder | Asset | Authors | Physical tile width |
| --- | --- | --- | --- |
| `brick_floor_04/` | [Brick Floor 04](https://polyhaven.com/a/brick_floor_04) | Dimitrios Savva | 1.9 m |
| `hinoki_planks/` | [Hinoki Planks](https://polyhaven.com/a/hinoki_planks) | Charlotte Baglioni | 1.9 m |
| `coated_pine/` | [Coated Pine](https://polyhaven.com/a/coated_pine) | Charlotte Baglioni (scan), Rico Cilliers (processing) | 0.7 m |
| `leafy_grass/` | [Leafy Grass](https://polyhaven.com/a/leafy_grass) | Charlotte Baglioni | 2.0 m |

Each folder holds the 2K JPEG diffuse (`diff_2k.jpg`), the 1K OpenGL-convention normal map (`nor_1k.png`)
and the 1K roughness map (`rough_1k.png`), downloaded from Poly Haven's CDN and re-encoded to 8-bit web sizes (diffuse JPEG quality 82, normal JPEG 4:4:4, roughness 8-bit PNG):

```
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/<asset>/<asset>_diff_2k.jpg
https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/<asset>/<asset>_nor_gl_1k.png
https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/<asset>/<asset>_rough_1k.png
```

The runtime maps them at true physical scale from metre-based UVs; see `src/scene/materialCatalog.ts`.
