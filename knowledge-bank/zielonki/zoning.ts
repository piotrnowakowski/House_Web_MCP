import type { LandUseZone, Vec2 } from '../../src/domain/types'

// Digitized dashed _MPZP entities in the supplied v2 DWG; see ZONING.md.
// Metre coordinates are model-derived, not legal setting-out precision.
export const zielonkiZoningParts: Array<LandUseZone & { parcel: string }> = [
  {
    "ref": "zoning/54-3/agricultural",
    "code": "06.R.21",
    "landRole": "agricultural",
    "boundary": [
      {
        "x": -18.403,
        "z": 10.53
      },
      {
        "x": -18.404,
        "z": 15.882
      },
      {
        "x": -9.246,
        "z": 15.882
      },
      {
        "x": -9.678,
        "z": 7.33
      },
      {
        "x": -9.7,
        "z": 6.794
      }
    ],
    "sourceRef": "source/mpzp-boundary-v2",
    "geometryConfidence": "derived",
    "parcel": "54/3"
  },
  {
    "ref": "zoning/54-3/construction",
    "code": "06.MNU.8",
    "landRole": "construction",
    "boundary": [
      {
        "x": -9.7,
        "z": 6.794
      },
      {
        "x": -10.621,
        "z": -15.591
      },
      {
        "x": -19.778,
        "z": -15.1
      },
      {
        "x": -18.403,
        "z": 10.53
      }
    ],
    "sourceRef": "source/mpzp-boundary-v2",
    "geometryConfidence": "derived",
    "parcel": "54/3"
  },
  {
    "ref": "zoning/55-3/agricultural",
    "code": "06.R.21",
    "landRole": "agricultural",
    "boundary": [
      {
        "x": -9.7,
        "z": 6.794
      },
      {
        "x": -9.678,
        "z": 7.33
      },
      {
        "x": -9.246,
        "z": 15.882
      },
      {
        "x": 0.8,
        "z": 15.882
      },
      {
        "x": 0.13,
        "z": 3.156
      },
      {
        "x": 0.1,
        "z": 2.587
      }
    ],
    "sourceRef": "source/mpzp-boundary-v2",
    "geometryConfidence": "derived",
    "parcel": "55/3"
  },
  {
    "ref": "zoning/55-3/construction",
    "code": "06.MNU.8",
    "landRole": "construction",
    "boundary": [
      {
        "x": 0.1,
        "z": 2.587
      },
      {
        "x": -0.397,
        "z": -6.83
      },
      {
        "x": -0.838,
        "z": -16.116
      },
      {
        "x": -10.621,
        "z": -15.591
      },
      {
        "x": -9.7,
        "z": 6.794
      }
    ],
    "sourceRef": "source/mpzp-boundary-v2",
    "geometryConfidence": "derived",
    "parcel": "55/3"
  },
  {
    "ref": "zoning/58-3/construction",
    "code": "06.MNU.8",
    "landRole": "construction",
    "boundary": [
      {
        "x": 18.635,
        "z": -5.211
      },
      {
        "x": 18.591,
        "z": -6.318
      },
      {
        "x": 18.21,
        "z": -15.861
      },
      {
        "x": 8.77,
        "z": -15.63
      },
      {
        "x": 8.7,
        "z": -16.628
      },
      {
        "x": -0.838,
        "z": -16.116
      },
      {
        "x": -0.397,
        "z": -6.83
      },
      {
        "x": 0.1,
        "z": 2.587
      },
      {
        "x": 17.384,
        "z": -4.833
      }
    ],
    "sourceRef": "source/mpzp-boundary-v2",
    "geometryConfidence": "derived",
    "parcel": "58/3"
  },
  {
    "ref": "zoning/58-3/agricultural",
    "code": "06.R.21",
    "landRole": "agricultural",
    "boundary": [
      {
        "x": 0.1,
        "z": 2.587
      },
      {
        "x": 0.13,
        "z": 3.156
      },
      {
        "x": 0.8,
        "z": 15.882
      },
      {
        "x": 19.477,
        "z": 15.883
      },
      {
        "x": 18.635,
        "z": -5.211
      },
      {
        "x": 17.384,
        "z": -4.833
      }
    ],
    "sourceRef": "source/mpzp-boundary-v2",
    "geometryConfidence": "derived",
    "parcel": "58/3"
  }
]

export const zielonkiZoningBoundary: Vec2[] = [{"x":-18.403,"z":10.53},{"x":17.384,"z":-4.833},{"x":18.635,"z":-5.211}]

