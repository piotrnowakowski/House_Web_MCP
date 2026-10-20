import { parseProject } from '../domain/schema'
import { synchronizePublishedProject } from './persistence'

export const NOWE_MPZP_V2_REF = 'project/nowe-mpzp-v2'

export async function synchronizePublishedNoweMpzpV2() {
  const [incoming, baseline] = await Promise.all([
    import('../../project-data/nowe-mpzp-v2/project.json'),
    import('../../project-data/nowe-mpzp-v2/initial-r1.json'),
  ])
  return synchronizePublishedProject(parseProject(incoming.default), parseProject(baseline.default))
}
