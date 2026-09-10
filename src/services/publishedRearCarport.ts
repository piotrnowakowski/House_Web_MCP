import { parseProject } from '../domain/schema'
import { synchronizePublishedProject } from './persistence'

export const REAR_CARPORT_STUDY_REF = 'project/zielonki-rear-carport'

/** Independent, user-requested third project from the preserved pre-road-carport layout. */
export async function synchronizePublishedRearCarport() {
  const [incoming, baseline] = await Promise.all([
    import('../../project-data/zielonki-rear-carport/project.json'),
    import('../../project-data/zielonki-rear-carport/initial-r49.json'),
  ])
  return synchronizePublishedProject(parseProject(incoming.default), parseProject(baseline.default))
}
