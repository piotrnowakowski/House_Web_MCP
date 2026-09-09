# Interior furniture assets

The 128 GLBs (64 configurations × desktop/mobile), 64 rendered PNG thumbnails, original linen/jute/oak/mesh/paint textures and their source generation code were independently authored for House & Garden Spatial Editor on 9 September 2026. Author: **House & Garden Spatial Editor contributors**. No IKEA preview mesh, product photograph, Scopia shop model or commercial model pack is bundled.

The expansion adds 32 selected products and 8 height alternatives. `scripts/interior-expanded-models.mjs` contains the new geometry studies. HEKTAR overall width and LINDBYN depth use explicitly marked planning estimates because those dimensions are absent from the inspected manufacturer listings.

These original assets are dedicated under **CC0 1.0 Universal**: https://creativecommons.org/publicdomain/zero/1.0/ . They may be copied, modified and redistributed, including commercially. The project's application source remains under its repository MIT licence. Product names identify the reference configurations; this package is not supplied or endorsed by IKEA. CC0 describes the original asset files, and does not grant trademark rights in product names.

`manifest.json` contains a source URL, article number, source date, finish, author, provenance, redistribution identifier, assembled dimensions, orientation, mounting elevation, footprint and file metrics for every configuration. `src/domain/ikea-products.json` is the product-fact source. See `docs/ikea-assets.md` for the human-readable dimension audit, carcass/assembly distinctions and redirected references.

Models use metres, Y up, front +Z and a floor-centred origin. The METOD wall frame's default elevation is 1.45 m. The bed envelope is the frame (176 × 209 cm), not the mattress (160 × 200 cm). MARKUS is shown at maximum overall height. Placement footprints are conservative outer envelopes; visual detail is independently approximated.

Shared room finish presets also use existing Poly Haven CC0 scans: Hinoki Planks (Charlotte Baglioni), Coated Pine (Charlotte Baglioni and Rico Cilliers), Concrete Tiles 02 (Charlotte Baglioni) and Square Tiles (Charlotte Baglioni). Full primary source links and attribution are already in `public/textures/README.md`; those textures are reused without new downloads.

Rebuild geometry with `npm run assets:interior` and thumbnails with `npm run assets:thumbnails` while the isolated dev server runs. Original texture sources and generation instructions are in `scripts/build_textiles.py` and `scripts/textiles/`.
