export interface WebMcpPromptDefinition {
  name: string
  title: string
  description: string
}

interface PromptBlocks {
  name: string
  title: string
  role: string
  task: string
  input: string
  tools: string
  output: string
  exampleOutput: string
}

const agentRole = 'You are a browser agent collaborating with a person inside House_Web_MCP, a conceptual 3D home and garden planner. Use stable semantic references and preserve human control.'

const resultContract = 'Call this WebMCP tool with a JSON object, not a JSON string. The app returns content[0].text as JSON with status, projectRevision and summary, plus optional variantRef, issues, metrics or data.'
const proposalResultContract = `${resultContract} A successful proposal returns status "variant_created" and a variantRef. It does not modify the committed project.`

const formatPrompt = ({ role, task, input, tools, output, exampleOutput }: PromptBlocks) => [
  `<role>\n${role}\n</role>`,
  `<task>\n${task}\n</task>`,
  `<input>\n${input}\n</input>`,
  `<tools>\n${tools}\n</tools>`,
  `<output>\n${output}\n</output>`,
  `<example_output>\n${exampleOutput}\n</example_output>`,
].join('\n\n')

const definePrompt = (blocks: PromptBlocks): WebMcpPromptDefinition => ({
  name: blocks.name,
  title: blocks.title,
  description: formatPrompt(blocks),
})

const proposalTools = 'Call get_project_state before proposing changes. After creating a variant, use compare_variants when comparison helps and request_apply_variant only when the person should review and decide. Never imply that a proposal is already committed.'

export const webMcpFieldPrompts = {
  positionX: 'East-west coordinate in meters.',
  positionZ: 'North-south coordinate in meters.',
  semanticRef: 'Stable semantic reference such as room/living-room.',
  gardenGoals: 'Design goals, for example low water, play lawn, vegetables, or year-round interest.',
} as const

export const webMcpToolPrompts = {
  get_project_state: definePrompt({
    name: 'get_project_state',
    title: 'Inspect Zielonki 3D project',
    role: agentRole,
    task: 'Read the current Zielonki parcel, evidence, geotechnical, planting, building, garden, climate, variant and validation state. Use this before proposing a change.',
    input: '`detail` (required enum): `summary`, `site`, `structure`, `garden`, or `full`. Use `site` for the sourced knowledge bank and `garden` for climate plus planting guidance.',
    tools: 'Use this read-only tool before proposal tools. Do not use it to claim that a variant has been applied.',
    output: resultContract,
    exampleOutput: '{"detail":"site"}',
  }),
  propose_plot_update: definePrompt({
    name: 'propose_plot_update',
    title: 'Propose plot update',
    role: agentRole,
    task: 'Create a reversible 3D variant that changes the plot boundary, north direction, or terrain elevation controls.',
    input: '`northDegrees` (optional number); `boundary` (optional array of at least three `{x,z}` meter points); `elevationPoints` (optional non-empty array of `{x,z,elevation}` meter points).',
    tools: proposalTools,
    output: proposalResultContract,
    exampleOutput: '{"northDegrees":-56.7}',
  }),
  propose_building_update: definePrompt({
    name: 'propose_building_update',
    title: 'Propose building update',
    role: agentRole,
    task: 'Create a reversible 3D variant that adds, removes, moves, rotates, or changes the roof of a building.',
    input: '`action` and `buildingRef` are required. Optional fields are `name`, `kind`, `position`, `rotationDegrees`, `roofType`, `pitchDegrees`, and `overhangM`; provide only fields relevant to the action.',
    tools: proposalTools,
    output: proposalResultContract,
    exampleOutput: '{"action":"set-roof","buildingRef":"house/main","roofType":"gable","pitchDegrees":30,"overhangM":0.45}',
  }),
  propose_floor_update: definePrompt({
    name: 'propose_floor_update',
    title: 'Propose floor update',
    role: agentRole,
    task: 'Create a reversible 3D variant that adds or removes a floor or changes its clear height.',
    input: '`action` (`add`, `remove`, or `set-height`), `buildingRef`, and `floorRef` are required. `name` and `heightM` are optional and action-dependent.',
    tools: proposalTools,
    output: proposalResultContract,
    exampleOutput: '{"action":"add","buildingRef":"house/main","floorRef":"floor/upper","name":"Upper floor","heightM":2.9}',
  }),
  propose_room_update: definePrompt({
    name: 'propose_room_update',
    title: 'Propose room update',
    role: agentRole,
    task: 'Create a reversible 3D variant that adds, removes, moves, resizes, rotates, or changes the ceiling of an unlocked room.',
    input: '`action`, `buildingRef`, `floorRef`, and `roomRef` are required. Optional action fields are `name`, `usage`, `position`, `widthM`, `depthM`, `heightM`, `rotationDegrees`, and `ceilingType`.',
    tools: proposalTools,
    output: proposalResultContract,
    exampleOutput: '{"action":"set-ceiling","buildingRef":"house/main","floorRef":"floor/ground","roomRef":"room/living-room","heightM":3.1,"ceilingType":"lowered"}',
  }),
  propose_mezzanine_update: definePrompt({
    name: 'propose_mezzanine_update',
    title: 'Propose mezzanine update',
    role: agentRole,
    task: 'Create a reversible 3D variant that adds, removes, or resizes a mezzanine inside an unlocked room.',
    input: '`action`, `buildingRef`, `floorRef`, `roomRef`, and `mezzanineRef` are required. Optional action fields are `position`, `widthM`, `depthM`, and `elevationM`.',
    tools: proposalTools,
    output: proposalResultContract,
    exampleOutput: '{"action":"add","buildingRef":"house/main","floorRef":"floor/ground","roomRef":"room/living-room","mezzanineRef":"room/living-room/mezzanine","widthM":2.4,"depthM":3}',
  }),
  propose_garage_update: definePrompt({
    name: 'propose_garage_update',
    title: 'Propose garage update',
    role: agentRole,
    task: 'Create a reversible 3D variant for an integrated or attached garage.',
    input: '`action` and `garageRef` are required. Optional action fields are `mode`, `position`, `widthM`, `depthM`, and `heightM`.',
    tools: proposalTools,
    output: proposalResultContract,
    exampleOutput: '{"action":"add","garageRef":"garage/main","mode":"attached","position":{"x":-8,"z":0},"widthM":6,"depthM":6,"heightM":2.7}',
  }),
  propose_garden_plan: definePrompt({
    name: 'propose_garden_plan',
    title: 'Propose complete garden',
    role: agentRole,
    task: 'Generate a reversible seasonal 3D garden variant from design goals, preserved elements and water preference. Respect the Zielonki planting guidance and ground constraints returned by get_project_state.',
    input: '`goals` (required non-empty string array); `preserveRefs` (string array, defaults to empty); `waterPreference` (`low`, `balanced`, or `lush`, defaults to `low`).',
    tools: proposalTools,
    output: proposalResultContract,
    exampleOutput: '{"goals":["low water","year-round interest"],"preserveRefs":["zone/terrace","plant/apple"],"waterPreference":"low"}',
  }),
  propose_garden_update: definePrompt({
    name: 'propose_garden_update',
    title: 'Propose garden update',
    role: agentRole,
    task: 'Create a reversible 3D variant that adds, removes, or moves one garden zone or plant.',
    input: '`action` and `subjectRef` are required. Optional action fields are `name`, `kind`, `position`, `widthM`, `depthM`, and `species`. Prefer species from the site planting guidance.',
    tools: proposalTools,
    output: proposalResultContract,
    exampleOutput: '{"action":"add-plant","subjectRef":"plant/guelder-rose","name":"Guelder rose","kind":"shrub","species":"Viburnum opulus","position":{"x":-11,"z":9}}',
  }),
  propose_climate_update: definePrompt({
    name: 'propose_climate_update',
    title: 'Propose climate update',
    role: agentRole,
    task: 'Create a reversible variant that edits one month of the local climate profile used by seasonal analysis.',
    input: '`month` (required integer 1–12). Optional values are `meanMinC`, `meanMaxC`, `precipitationMm`, `sunshineHours`, `et0Mm`, `frostDays`, and `windKph`.',
    tools: proposalTools,
    output: proposalResultContract,
    exampleOutput: '{"month":7,"precipitationMm":88,"et0Mm":118}',
  }),
  run_seasonal_analysis: definePrompt({
    name: 'run_seasonal_analysis',
    title: 'Run seasonal analysis',
    role: agentRole,
    task: 'Estimate daylight, representative sun, water balance, drought, frost, foliage and bloom for selected months in the base project or one variant.',
    input: '`months` (integer array from 1–12, defaults to `[1,4,7,10]`); `variantRef` (optional stable variant reference).',
    tools: 'Use get_project_state first when project context is unknown. This tool is read-only and must not be presented as a professional weather, irrigation or horticultural assessment.',
    output: resultContract,
    exampleOutput: '{"months":[1,4,7,10]}',
  }),
  compare_variants: definePrompt({
    name: 'compare_variants',
    title: 'Compare 3D variants',
    role: agentRole,
    task: 'Compare metrics, validation issues and revisions for up to four existing visible 3D variants.',
    input: '`variantRefs` (required array containing one to four existing stable variant references).',
    tools: 'Use proposal tools to create variants first. This tool is read-only; use request_apply_variant separately when the person should make a decision.',
    output: resultContract,
    exampleOutput: '{"variantRefs":["variant/example-a","variant/example-b"]}',
  }),
  request_apply_variant: definePrompt({
    name: 'request_apply_variant',
    title: 'Request variant approval',
    role: agentRole,
    task: 'Open the selected ghost variant in the 3D canvas and wait for the person to apply or reject it.',
    input: '`variantRef` (required existing stable variant reference).',
    tools: 'Use only after a proposal tool returns the variantRef and the person has enough context to review it. Never approve on the person’s behalf. Agent cancellation closes the pending confirmation.',
    output: `${resultContract} The promise resolves only after the person chooses Apply or Reject, returning status "applied" or "rejected".`,
    exampleOutput: '{"variantRef":"variant/example-a"}',
  }),
  discard_variant: definePrompt({
    name: 'discard_variant',
    title: 'Discard variant',
    role: agentRole,
    task: 'Discard one uncommitted proposal without changing the committed project.',
    input: '`variantRef` (required existing stable variant reference).',
    tools: 'Use for an unwanted uncommitted variant. Do not use it to undo an applied change; use undo_last_change for that.',
    output: resultContract,
    exampleOutput: '{"variantRef":"variant/example-a"}',
  }),
  undo_last_change: definePrompt({
    name: 'undo_last_change',
    title: 'Undo committed change',
    role: agentRole,
    task: 'Undo the most recent committed project change without affecting uncommitted variants.',
    input: 'Pass an empty JSON object.',
    tools: 'Use only when the person requests reversal of the latest applied change. Use discard_variant for uncommitted proposals.',
    output: resultContract,
    exampleOutput: '{}',
  }),
  request_export: definePrompt({
    name: 'request_export',
    title: 'Request project export',
    role: agentRole,
    task: 'Ask the person to confirm export of versioned project JSON, the visible 3D scene as GLB, or a PNG image.',
    input: '`format` (required enum): `json`, `glb`, or `png`.',
    tools: 'Use only when an export is requested. The tool waits for explicit human confirmation and agent cancellation closes the pending request.',
    output: `${resultContract} The export starts only after the person confirms it in the canvas.`,
    exampleOutput: '{"format":"glb"}',
  }),
} as const

export type WebMcpToolPromptName = keyof typeof webMcpToolPrompts
