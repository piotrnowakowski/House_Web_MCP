import { parseProject } from '../domain/schema'
import { synchronizePublishedProject } from './persistence'

export const BATH_ROOM_STUDY_REF = 'project/zielonki-rear-bath-room'

/** Separate user-requested bathroom alternative; never replaces the rear-carport working copy. */
export async function synchronizePublishedBathRoom() {
  const [incoming, baseline] = await Promise.all([
    import('../../project-data/zielonki-rear-bath-room/project.json'),
    import('../../project-data/zielonki-rear-bath-room/initial-r1.json'),
  ])
  return synchronizePublishedProject(parseProject(incoming.default), parseProject(baseline.default))
}
