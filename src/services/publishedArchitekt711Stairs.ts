import { parseProject } from '../domain/schema'
import { synchronizePublishedProject } from './persistence'

export const ARCHITEKT_711_STAIRS_REF = 'project/architekt-7-11-stairs-12-6'
export async function synchronizePublishedArchitekt711Stairs() {
  const [incoming, baseline] = await Promise.all([
    import('../../project-data/architekt-7-11-stairs-12-6/project.json'),
    import('../../project-data/architekt-7-11-stairs-12-6/initial-r1.json'),
  ])
  return synchronizePublishedProject(parseProject(incoming.default), parseProject(baseline.default))
}
