# House reconstruction from the 18 supplied screenshots

Open **Projects → Dom z planów · Reference house → House interior**. The entry creates an independent project on first use and subsequently opens its saved edits. It never seeds the Zielonki demo garden into this project.

All geometry is in metres. Room dimensions in the interior editor are **between inside wall faces**; areas are computed from geometry, excluding internal partitions and fully enclosed floor openings. The floor summary identifies gross slab area separately. Furniture dimensions are its editable overall bounding box (including chairs for the dining set).

## Ground floor

| Space | Clear dimensions | Computed area | Source |
| --- | --- | --- | --- |
| Salon, kitchen and hall | Main rectangle 10.79 × 7.35; hall extension 4.30 × 1.79 | 86.3715 m² after the 3.16 × 0.20 stair partition | Full plans 7/18, close-ups 12/14/15 |
| Utility / pantry | 1.84 × 2.17 | 3.9928 m² | 15, 17 |
| Ground bathroom | 2.26 × 2.17 | 4.9042 m² | 15, 17 |
| Office | 2.78 × 3.96 | 11.0088 m² | 14 |
| Garage | 7.28 × 6.20 | 45.1360 m² | 16, 17 |

The clear living-room origin is the upper-left inside corner in the 2D screenshots. X runs right, Z runs down. Its main rectangle occupies X 0–10.79, Z 0–7.35; the hall reaches Z 9.14. Utility rooms occupy Z 9.34–11.51, the office Z 7.55–11.51, and garage Z 11.71–17.91. Inferred 0.20 m walls connect these spaces without overlapping room interiors.

The kitchen island is 1.28 × 2.92 m. The 0.65 m counter depth is estimated; the island's west edge is X 1.87, maintaining the printed **1.22 m aisle**. One close-up rounds the island width to 1.29 m; the repeated 1.28 m dimension is used. Stairs occupy 3.16 × 0.94 m, and the cabinet below the partition is 3.16 × 0.62 m. The garage gate is 6.36 m wide and the approach is 6.36 × 5.08 m.

The turquoise L-shaped sofa is approximately 3.45 × 2.52 m, matching the selected-object close-up. The dining set has a 1.84 × 0.81 m tabletop and six chairs. The car is estimated at 1.85 × 4.50 m. Furniture location, heights, window widths/sills and door widths are visually inferred where not dimensioned. The renderer uses editable procedural models, not the original proprietary object assets.

## Upper floor

| Space | Clear dimensions | Computed area | Source discrepancy |
| --- | --- | --- | --- |
| Parents' bedroom | 5.15 × 4.50 | 23.175 m² | Depth inferred from printed width and 23.17 m² label |
| Mezzanine | 5.53 × 7.35 | 40.6455 m² | Matches 40.65 m²; solid floor follows the 3D view |
| Laundry / wardrobe | Approx. 2.08–2.10 wide × 3.35 deep | Approx. 7.00 m² | Slightly tapered east wall matches unequal widths |
| Bathroom | 2.03 × 2.92 | 5.9276 m² | Matches 5.93 m²; adjacent chain labels differ |
| Child bedroom 1 | 3.52 × 4.07 | 14.3264 m² | Source area reads 14.37; printed lengths take precedence |
| Child bedroom 2 | 3.54 × 4.07 | 14.4078 m² | Matches 14.41 m² |
| Landing | Connected polygon between the above rooms | Derived from the reconstructed boundary and stair opening | Its source area label is obscured and some chain dimensions conflict |

The upstairs footprint is 9–10 cm wider than the ground floor because the upper room widths do not add up to the ground-floor width with consistent partitions. The wall between the children's rooms is inferred at 0.32 m so their printed clear widths both fit. Upper-floor front rooms end at Z 14.74, short of the garage front, as in the 3D image.

The upper stair opening is narrowed by 10 cm at the parents' bedroom wall so it does not cut into the bedroom. It follows the ground staircase location. The source does not establish a consistent landing/headroom detail. The mezzanine plan shows no access door; an inferred 1.10 m doorway from the landing makes it accessible. These adjustments need the original plan for exact resolution.

Only the parents' bed is placed upstairs; the other upper rooms are empty in the supplied views.

## Provisional values

- Each ceiling is 2.80 m high, with a 0.20 m intermediate slab; floor elevations are 0 and 3.00 m. Ceiling heights were requested from the user but have not been supplied.
- Sixteen stair risers, windows, door positions and sizes, furniture heights and finishes are estimated.
- Roof geometry is not shown. A provisional flat cap supports the existing plot editor's roof model; it is hidden in the interior editor.
- The 30 × 40 m contextual plot, building placement, north orientation and geographical coordinates are placeholders. The screenshot boundary labels are incomplete and cannot establish a surveyed site.
- The terrace outline and wood finish follow the views approximately; approach length and width use the printed dimensions.

## Source filenames

All files were supplied by the user from `C:/Users/WBW/Downloads/`:

- Upper plan (2): `188afe5f-9b61-48af-998e-3ac18b166e4e.jpg`
- Upper 3D (1): `08eb10de-d718-4be0-aaef-10b26a30f5b9.jpg`
- Ground plans (7, 18): `b3d194f0-14d6-4296-accc-d077fa481463.jpg`, `6f872b3d-f28a-4f3d-97ad-c6ad9e2f5be3.jpg`
- Kitchen/stairs (12, 13): `3d3e0203-3393-4c89-96b5-557f039c03bd.jpg`, `76fe4b1a-2981-447d-9658-cca0750e3df2.jpg`
- Office (14): `da0d221d-4dd7-4bf1-a9aa-6947ad6a16e9.jpg`
- Service rooms (15): `2b45a953-fd50-4ae2-bc30-2cdaa5534006.jpg`
- Garage/approach (16, 17): `358471cf-9c39-4c0a-8b22-31631f700fc7.jpg`, `f14c7089-f9ed-46bc-b14d-a00d48f5f747.jpg`
- Sofa/table (10, 11): `dee7f956-6571-43a6-994d-e9eb6731ceee.jpg`, `777eb831-53ee-4687-9b32-1c09dc1c38fb.jpg`
- Ground 3D (3, 4, 6, 8): `b8510a67-6c06-4b6e-9ea7-72a9257f3f3e.jpg`, `77063908-87dd-42bf-9024-4589503b68f9.jpg`, `c13cb3ac-d3cb-4a25-adb4-294bff8ae0b5.jpg`, `25408ab1-2eb1-4361-8b26-88ec1cef3641.jpg`
- Site overview (9): `cfd6e6c0-001c-4ef7-8e9b-d4da2f7e4e93.jpg`
- Image 5 duplicates image 4 and contains an unrelated notification, which was ignored.

The reconstruction is dimensionally faithful to the legible measurements listed above. Conflicting or missing dimensions prevent a claim of an exact, fully verified 1:1 model of every detail.

## Zielonki adaptation

The interior editor can fit the saved reference house into the saved Zielonki project. This translates the floor coordinates to the centre of the former house, retaining its position, rotation, site, landscape and garden fixtures. It does not scale the measured rooms or furniture. A separate saved project retains the previous house before fitting; the reference project also remains separate.

The resulting ground envelope is 11.19 × 18.31 m; the upper envelope is 11.28 × 15.14 m. The exterior inherits Zielonki's dark timber facade and standing-seam metal roof finish. Two perpendicular 45° gable wings cover the upper floor, and a lower flat dark roof covers the front garage portion beyond the upper floor. Ceiling heights remain provisional at 2.80 m. The roof design is an adaptation, since the supplied interior screenshots do not specify a roof.

The Zielonki project card now continues the saved project. Its legacy barn preset migration preserves this fitted floor plan and lower garage roof. Source notes live on the building so site knowledge updates cannot remove them.
