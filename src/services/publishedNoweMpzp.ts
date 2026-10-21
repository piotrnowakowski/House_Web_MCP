import { parseProject } from '../domain/schema'
import { synchronizePublishedProject } from './persistence'

export const NOWE_MPZP_REF = 'project/nowe-mpzp'

export async function synchronizePublishedNoweMpzp() {
  const [incoming, baseline] = await Promise.all([
    import('../../project-data/nowe-mpzp/project.json'),
    import('../../project-data/nowe-mpzp/initial-r1.json'),
  ])
  return synchronizePublishedProject(parseProject(incoming.default), parseProject(baseline.default))
}
