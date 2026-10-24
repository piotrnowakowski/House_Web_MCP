# Garden model assets

The garden uses four models from Poly Haven's photorealistic CC0 library:

- `orchard-tree-realistic.glb` — [Tree Small 02](https://polyhaven.com/a/tree_small_02), by Rico Cilliers.
- `crop-tomato-foliage.glb` — [Nettle Plant](https://polyhaven.com/a/nettle_plant), photography by Rob Tuytel and modelling by Rico Cilliers.
- `crop-potato-foliage.glb` — [Weed Plant 02](https://polyhaven.com/a/weed_plant_02), photography by Rob Tuytel and modelling by Rico Cilliers.

All four source assets are released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The original 1K glTF downloads were converted to local GLB assets with glTF Transform, using Meshopt geometry compression, 512 px WebP textures, and controlled mesh simplification for browser rendering. The application does not hotlink the source library.

The deciduous tree mesh is shared across the apple, sour cherry, pear, and plum records with species-specific proportions and rotations. This provides credible orchard-scale vegetation without claiming that one generic source mesh is a botanical scan of four species. Small seasonal fruit and blossom cues remain procedural.

The crop source meshes provide detailed, textured foliage. They are visually adapted into tomato, potato, and cucumber rows; their use is representational rather than a botanical identification of the Poly Haven source plants.

## Mapped conifers

The mapped conifer row uses conifer-realistic.glb, adapted from [Pine Sapling Medium](https://polyhaven.com/a/pine_sapling_medium), modelling by Rico Cilliers and photography by Rob Tuytel, under CC0. One rooted tree was selected from the three-variant glTF, simplified to 40,012 triangles, and compressed with Meshopt and embedded 512 px WebP bark/needle textures (1.52 MB). The mapped deciduous and fruit trees share the existing detailed Tree Small 02 asset. These are visual representations; the map does not identify botanical species.

## Garden rendering update — 24 October 2026

The detailed orchard asset retains its original textures and separate bark/leaf materials, with geometry reduced from 491,645 to 30,080 triangles. `orchard-tree-mobile.glb` (30,080 triangles, 606,468 bytes) and `conifer-mobile.glb` (40,012 triangles, 1,354,764 bytes) are derived from the same CC0 source assets above. They retain 256 px WebP textures and seasonal leaf visibility. Their geometry preserves the detailed crown: aggressive leaf simplification was rejected after browser inspection showed sparse summer trees. The mobile assets are used in fast/automatic mobile mode, so trees no longer become solid balls during normal operation. The emergency loading/error fallback remains available.

The columnar evergreen visual is adapted from [Columnar cypress tree](https://www.innerscene.com/tools/library/3d-parts/columnar-cypress-tree-46fad033), an original Innerscene model released under CC0; retrieved 24 October 2026. The model is used as a representative columnar evergreen at the saved arborvitae dimensions, not as a botanical scan of Thuja occidentalis 'Smaragd'. Source branches were joined by material, geometry simplified and textures embedded as WebP. `columnar-evergreen.glb` has 20,930 triangles / 882,260 bytes; its mobile version has 12,614 triangles / 511,200 bytes. The four new tree assets are hosted locally; no external model provider is contacted at runtime.

Feather-reed grass is generated in `src/scene/vegetationGeometry.ts` with curved blades and seed heads. Four shared tuft geometries per quality tier bound repeated planting memory. Rotation varies deterministically by plant reference. The grass rendering does not alter planting locations or dimensions. The schematic solar-cell texture in `public/textures/solar-module.svg` is authored for this application; its pattern is illustrative, not a product specification.

## Owner-identified tall trees — 24 October 2026

Variant 2 r13 identifies the two gate-side trees as Pinus sp. and six trees opposite the house as Picea sp., based on the owner’s description. Separate visual models are adapted from [Pine Tree 01](https://polyhaven.com/a/pine_tree_01) and [Fir Tree 01](https://polyhaven.com/a/fir_tree_01), by Rico Cilliers (modelling) and Rob Tuytel (photography), under CC0. Retrieved 24 October 2026. Pine uses variant b and the full conifer uses variant a. The fir asset is a visual proxy for the spruce silhouette, not a botanical Picea scan; semantic identification remains Picea sp. as supplied by the owner. Earlier Innerscene mature-tree candidates were rejected after browser inspection showed sparse, artificial crowns. Both final assets retain the project's saved 15 m height and crown widths.

Each source was reduced to one rooted tree, simplified with target ratios 0.06 (pine) and 0.12 (fir) / 0.01 error, and compressed with Meshopt and 512 px WebP textures. `mature-pine.glb`: 246930 triangles / 6904020 bytes; `mature-spruce.glb`: 501026 triangles / 18983084 bytes. Both quality modes retain the same crown geometry; reducing needle geometry further made the trees look bare. The two mature-tree downloads total about 26 MB; physical-phone performance remains unverified. Unidentified conifers in other projects continue to use the existing pine-sapling representation.
