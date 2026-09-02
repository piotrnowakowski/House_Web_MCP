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

## Garden material assets

The seven seamless garden material sources in `public/textures/` are original
AI-assisted assets generated specifically for House_Web_MCP with OpenAI image
generation and optimized to 1024 px JPEG files for real-time rendering. They
were not downloaded from a third-party texture library. The runtime adds
project-authored tiling, seasonal tint, bump response, roughness, scatter, and
procedural geometry.

## Runtime libraries

This project uses React, Three.js, React Three Fiber, Drei, Zustand, Zod, and
Vite under their respective open-source licenses. No third-party 3D models,
textures, photos, logos, or music are bundled. The garden geometry is generated
procedurally at runtime.
