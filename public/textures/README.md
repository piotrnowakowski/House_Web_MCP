# Texture sources

All material scans in this folder come from [Poly Haven](https://polyhaven.com) and are released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain). Attribution is not
required by the licence; it is given here because the scans deserve it.

| Folder | Asset | Authors | Physical tile width | Used on |
| --- | --- | --- | --- | --- |
| `medieval_red_brick/` | [Medieval Red Brick](https://polyhaven.com/a/medieval_red_brick) | Rob Tuytel | 2.0 m | walls (brick default) |
| `brick_floor_04/` | [Brick Floor 04](https://polyhaven.com/a/brick_floor_04) | Dimitrios Savva | 1.9 m | walls, ground |
| `hinoki_planks/` | [Hinoki Planks](https://polyhaven.com/a/hinoki_planks) | Charlotte Baglioni | 1.9 m | walls (natural timber default), raised beds |
| `coated_pine/` | [Coated Pine](https://polyhaven.com/a/coated_pine) | Charlotte Baglioni (scan), Rico Cilliers (processing) | 0.7 m | walls, barn interior floors |
| `rusty_painted_metal/` | [Rusty Painted Metal](https://polyhaven.com/a/rusty_painted_metal) | Amal Kumar | 2.2 m | walls (metal panel default) |
| `concrete_tiles_02/` | [Concrete Tiles 02](https://polyhaven.com/a/concrete_tiles_02) | Charlotte Baglioni | 1.8 m | ground (terrace default) |
| `brick_pavement/` | [Brick Pavement](https://polyhaven.com/a/brick_pavement) | Charlotte Baglioni | 2.0 m | ground (driveway default) |
| `square_tiles/` | [Square Tiles](https://polyhaven.com/a/square_tiles) | Charlotte Baglioni | 2.4 m | ground (path default) |
| `leafy_grass/` | [Leafy Grass](https://polyhaven.com/a/leafy_grass) | Charlotte Baglioni | 2.0 m | ground (lawn default), terrain |
| `dirt_floor/` | [Dirt Floor](https://polyhaven.com/a/dirt_floor) | eye-candy.xyz | 2.1 m | ground (vegetable default), raised-bed soil |
| `forest_leaves_02/` | [Forest Leaves 02](https://polyhaven.com/a/forest_leaves_02) | Rob Tuytel | 3.0 m | ground (bed default) |
| `dry_river_pebbles/` | [Dry River Pebbles](https://polyhaven.com/a/dry_river_pebbles) | Amal Kumar | 2.0 m | ground (rain-garden default) |

Each folder holds the JPEG diffuse (`diff_2k.jpg`, or `diff_1k.jpg` for the three soil scans that are only seen
from a distance), the 1K OpenGL-convention normal map (`nor_1k.jpg`), the 1K greyscale roughness map (`rough_1k.jpg`)
and a 256 px `preview.jpg` for the pickers. Sources are Poly Haven's CDN downloads or the `.blend` bundles,
re-encoded to 8-bit web sizes (diffuse JPEG quality 82, normal JPEG 4:4:4, roughness greyscale JPEG):

```
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/<asset>/<asset>_diff_2k.jpg
https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/<asset>/<asset>_nor_gl_1k.png
https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/<asset>/<asset>_rough_1k.png
```

The library itself (ids, tile widths, surfaces and defaults) lives in `src/domain/textures.ts`; the runtime maps
the scans at true physical scale from metre-based UVs, see `src/scene/materialCatalog.ts`.
