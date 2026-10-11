import { parseProject } from '../domain/schema'
import { synchronizePublishedProject } from './persistence'

export const ARCHITEKT_REF = 'project/architekt'

/** Independent architect reconstruction; its own baseline preserves local edits and deletions. */
export async function synchronizePublishedArchitekt() {
  const [incoming, baseline] = await Promise.all([
    import('../../project-data/architekt/project.json'),
    import('../../project-data/architekt/initial-r1.json'),
  ])
  return synchronizePublishedProject(parseProject(incoming.default), parseProject(baseline.default))
}
