import { useStudioStore } from '../state/store'
import { loadWorkspace, saveWorkspace, synchronizePublishedProject } from './persistence'
import { legacyProjectBase, publishedProject } from './publishedProject'
import { V2_STUDY_REF, synchronizePublishedV2 } from './publishedV2'
import { REAR_CARPORT_STUDY_REF, synchronizePublishedRearCarport } from './publishedRearCarport'

export const CARPORT_STUDY_REF = V2_STUDY_REF
export const HOUSE_STUDY_REF = publishedProject.ref

/** Flush the current working copy before changing projects. Published data merges by entity ref. */
export async function openHouseStudy(ref: string) {
  if (![CARPORT_STUDY_REF, HOUSE_STUDY_REF, REAR_CARPORT_STUDY_REF].includes(ref)) throw new Error('Unknown house study.')
  const current = useStudioStore.getState()
  await saveWorkspace({ version: 1, project: current.project, proposals: current.proposals, draftChangeSets: current.draftChangeSets })
  let conflicts: string[]
  if (ref === CARPORT_STUDY_REF) {
    conflicts = await synchronizePublishedV2()
  } else if (ref === REAR_CARPORT_STUDY_REF) {
    conflicts = await synchronizePublishedRearCarport()
  } else {
    conflicts = await synchronizePublishedProject(publishedProject, legacyProjectBase)
  }
  const target = await loadWorkspace(ref)
  if (!target) throw new Error('The selected house could not be loaded.')
  await saveWorkspace(target)
  useStudioStore.getState().restoreWorkspace(target)
  useStudioStore.setState((state) => ({
    hydrated: true, launcherOpen: false, selectedRef: null, repositioningRef: null, confirmationVariantRef: null,
    viewerMode: 'edit', activePlanStoreyRef: null, explodeStoreys: false,
    neighborViewRequest: { sequence: state.neighborViewRequest.sequence + 1, ref: '', eyeHeightM: 1.6 },
    projectSyncConflicts: conflicts, cameraRefocusRequest: state.cameraRefocusRequest + 1,
    toast: conflicts.length ? 'Published changes conflict with your edits. Both versions are kept in Projects.' : `Opened ${target.project.name}.`,
  }))
}
