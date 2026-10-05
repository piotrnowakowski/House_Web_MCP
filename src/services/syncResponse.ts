export const unavailableSyncMessage = 'The Mikrus sync service is not deployed yet. Your changes are saved on this device.'

export async function readSyncJson<T>(response: Response): Promise<T> {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new Error(unavailableSyncMessage)
  try { return await response.json() as T }
  catch { throw new Error('Mikrus returned an invalid response. Your local project is preserved; try again after the service is restored.') }
}
