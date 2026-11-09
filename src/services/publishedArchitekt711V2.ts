import { parseProject } from '../domain/schema'
import { synchronizePublishedProject } from './persistence'

export const ARCHITEKT_711_V2_REF = 'project/architekt-7-11-v2'
export async function synchronizePublishedArchitekt711V2() {
  const [incoming, baseline] = await Promise.all([
    import('../../project-data/architekt-7-11-v2/project.json'),
    import('../../project-data/architekt-7-11-v2/initial-r1.json'),
  ])
  return synchronizePublishedProject(parseProject(incoming.default), parseProject(baseline.default))
}
