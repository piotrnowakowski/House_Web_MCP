import { parseProject } from '../domain/schema'
import { synchronizePublishedProject } from './persistence'

export const PAULINA_REF = 'project/paulina-poprawki'

/** Independent screenshot revision; never replaces architekt or its browser workspace. */
export async function synchronizePublishedPaulina() {
  const [incoming, baseline] = await Promise.all([
    import('../../project-data/paulina-poprawki/project.json'),
    import('../../project-data/paulina-poprawki/initial-r1.json'),
  ])
  return synchronizePublishedProject(parseProject(incoming.default), parseProject(baseline.default))
}
