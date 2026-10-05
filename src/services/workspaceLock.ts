let reason: string | null = null
let internal = false
let activities = 0
export const runWorkspaceActivity = async <T>(action: () => Promise<T>): Promise<T> => {
  assertWorkspaceEditable()
  activities++
  try { return await action() } finally { activities-- }
}
export const assertWorkspaceEditable = () => { if (reason && !internal) throw new Error(reason) }
export const lockWorkspace = (message: string) => {
  assertWorkspaceEditable()
  if (activities) throw new Error('Wait for the current project operation to finish before synchronizing.')
  reason = message
  return () => { reason = null }
}
/** Synchronous application of an already validated sync result; never span an await. */
export const applyLockedWorkspace = <T>(action: () => T): T => {
  internal = true
  try { return action() } finally { internal = false }
}
