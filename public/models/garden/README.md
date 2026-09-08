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
