# Data and software attributions

## Climate preset

The editable Zielonki, Krakow demonstration preset uses the same monthly
variables exposed by the Open-Meteo Historical Weather API: temperature,
precipitation, sunshine, wind, frost-day estimates, and reference
evapotranspiration. The bundled values are illustrative planning inputs and
must not be treated as an official meteorological normal.

- Source documentation: https://open-meteo.com/en/docs/historical-weather-api
- Underlying reanalysis families: ERA5 and ERA5-Land
- Open-Meteo API data license: Creative Commons Attribution 4.0 International

The application runs entirely from committed local data and makes no weather
request at runtime.

## Texture scans

The four material scans in `public/textures/` come from [Poly Haven](https://polyhaven.com)
and are released under CC0 1.0 (public domain): Brick Floor 04 by Dimitrios Savva, Hinoki
Planks and Leafy Grass by Charlotte Baglioni, and Coated Pine by Charlotte Baglioni and Rico
Cilliers. They are re-encoded to web sizes (2K JPEG diffuse, 1K JPEG normal, 1K 8-bit PNG
roughness, about 9.5 MB in total) and mapped at true physical scale from metre-based UVs that
the geometry worker generates for every wall and slab. Per-asset links and the exact source
URLs are listed in `public/textures/README.md`.

## Runtime libraries

This project uses React, Three.js, React Three Fiber, Drei, Rapier, That Open
Components, Manifold, Zustand, Zod, and Vite under their respective open-source
licenses. Garden crop geometry is generated procedurally at runtime.

## Garden models

Four deciduous tree meshes are adapted from Quaternius' Stylized Nature MegaKit,
released under CC0 1.0 Universal. They are bundled as optimized GLB files and used
as the visual bases for apple, sour cherry, pear, and plum trees. Species-specific
fruit and blossom details remain procedural. Full source and processing notes are
in `public/models/garden/README.md`.
