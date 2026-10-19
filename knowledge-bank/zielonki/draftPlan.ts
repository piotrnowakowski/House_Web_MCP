import type { ProjectV2 } from '../../src/domain/types'

export const DRAFT_PLAN_VERSION = 'zielonki-mpzp-draft-2026-10-19'
export const usesDraftPlan = (project: ProjectV2) => project.site.knowledgeBase.datasetVersion === DRAFT_PLAN_VERSION

// Registered to the PDF's PL-2000 grid; conceptual precision, see MPZP-DRAFT-2026-10-19.md.
export const draftZoningLine = { slope: -0.18279848635434473, intercept: 7.692912267376711 }
export const draftZoningBoundary = [
  { x: -18.403098462408543, z: 11.056970810534962 },
  { x: 19.011457765689624, z: 4.217646564419095 },
]
