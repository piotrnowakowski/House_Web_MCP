import { beforeEach, describe, expect, it } from 'vitest'
import { sampleProject } from '../domain/sampleProject'
import { useStudioStore } from '../state/store'
import { resolveVariantConfirmation, webMcpTools } from './webmcp'

const tool = (name: string) => webMcpTools.find((item) => item.name === name)!
const payload = (result: WebMcpToolResult) => JSON.parse(result.content[0].text)

beforeEach(() => {
  useStudioStore.setState({
    project: structuredClone(sampleProject), history: [], variants: [], selectedRef: 'room/living-room', confirmationVariantRef: null, pendingExport: null,
  })
})

describe('native WebMCP surface', () => {
  it('publishes the complete, uniquely named tool surface', () => {
    expect(webMcpTools).toHaveLength(16)
    expect(new Set(webMcpTools.map((item) => item.name)).size).toBe(16)
    expect(tool('get_project_state').annotations?.readOnlyHint).toBe(true)
    expect(tool('run_seasonal_analysis').annotations?.readOnlyHint).toBe(true)
  })

  it('reads state when a browser omits execute options', async () => {
    const result = await tool('get_project_state').execute({ detail: 'summary' })
    expect(payload(result)).toMatchObject({ status: 'ok', projectRevision: 1, metrics: { roomCount: 4 } })
  })

  it('serves the Zielonki evidence bank through the native read-only surface', async () => {
    const result = await tool('get_project_state').execute({ detail: 'site' })
    const parsed = payload(result)

    expect(parsed.status).toBe('ok')
    expect(parsed.data.plot.parcels.map((parcel: { cadastralNumber: string }) => parcel.cadastralNumber)).toEqual([
      '54/3', '55/3', '58/3', '54/4', '55/4', '58/4',
    ])
    expect(parsed.data.knowledgeBase).toMatchObject({
      locality: 'Zielonki, Małopolskie, Poland',
      geotechnical: { weakBearingToApproxM: 4, groundwaterRangeM: [1.6, 2.3] },
      planting: { recommendations: expect.any(Array) },
    })
  })

  it('returns climate and site-fit planting guidance with garden state', async () => {
    const result = await tool('get_project_state').execute({ detail: 'garden' })
    const parsed = payload(result)

    expect(parsed.data.climateProfile.months).toHaveLength(12)
    expect(parsed.data.plantingGuidance.recommendations).toContainEqual(expect.objectContaining({
      botanicalName: 'Carpinus betulus', priority: 'best-fit',
    }))
  })

  it('creates a reversible variant instead of committing a mutation', async () => {
    const result = await tool('propose_floor_update').execute({ action: 'add', buildingRef: 'house/main', floorRef: 'floor/upper-webmcp', name: 'Upper floor', heightM: 2.9 })
    const parsed = payload(result)
    expect(parsed.status).toBe('variant_created')
    expect(useStudioStore.getState().project.revision).toBe(1)
    expect(useStudioStore.getState().variants).toHaveLength(1)
    expect(useStudioStore.getState().variants[0].project.buildings[0].floors).toHaveLength(2)
  })

  it('waits for explicit human approval before applying a variant', async () => {
    await tool('propose_room_update').execute({ action: 'set-ceiling', buildingRef: 'house/main', floorRef: 'floor/ground', roomRef: 'room/living-room', heightM: 3.1, ceilingType: 'lowered' })
    const ref = useStudioStore.getState().variants[0].ref
    const waiting = tool('request_apply_variant').execute({ variantRef: ref }, { signal: new AbortController().signal })
    await Promise.resolve()
    expect(useStudioStore.getState().confirmationVariantRef).toBe(ref)
    resolveVariantConfirmation(true)
    expect(payload(await waiting)).toMatchObject({ status: 'applied', projectRevision: 2, variantRef: ref })
    expect(useStudioStore.getState().project.buildings[0].floors[0].rooms[0]).toMatchObject({ heightM: 3.1, ceilingType: 'lowered' })
  })

  it('honors an already-aborted execution signal', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await tool('run_seasonal_analysis').execute({ months: [1, 7] }, { signal: controller.signal })
    expect(payload(result).status).toBe('cancelled')
  })
})
