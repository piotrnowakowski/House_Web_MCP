import { parseProject } from '../domain/schema'
import { synchronizePublishedProject } from './persistence'

export const V2_STUDY_REF = 'project/zielonki-v2'

/** Update the existing v2 identity; its pre-carport snapshot is the first publication baseline. */
export async function synchronizePublishedV2() {
  const [incoming, baseline] = await Promise.all([
    import('../../project-data/zielonki-v2/project.json'),
    import('../../project-data/zielonki-v2/before-carport-r46.json'),
  ])
  return synchronizePublishedProject(parseProject(incoming.default), parseProject(baseline.default))
}
