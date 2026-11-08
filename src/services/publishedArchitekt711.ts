import { parseProject } from '../domain/schema'
import { synchronizePublishedProject } from './persistence'

export const ARCHITEKT_711_REF = 'project/architekt-7-11'
export async function synchronizePublishedArchitekt711() {
  const [incoming, baseline] = await Promise.all([
    import('../../project-data/architekt-7-11/project.json'),
    import('../../project-data/architekt-7-11/initial-r1.json'),
  ])
  return synchronizePublishedProject(parseProject(incoming.default), parseProject(baseline.default))
}
