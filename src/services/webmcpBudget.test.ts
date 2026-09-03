import { describe, expect, it } from 'vitest'
import { catalogBudget } from './webmcpDefinitions'
import { webMcpTools } from './webmcp'

/** ChatGPT rejects site-tool catalogs above 5000 tokens (names, descriptions and schemas together); 3.5 chars per token is a conservative estimate for JSON. */
const TOKEN_BUDGET = 5000
const CHAR_BUDGET = 14_000
const LARGEST_TOOL_CHARS = 2_500

const expectedNames = ['get_project_state', 'get_site_knowledge', 'get_proposals', 'list_catalog', 'measure_height', 'run_analysis', 'show_structure_views', 'set_viewer_state', 'propose_change', 'manage_change_set', 'manage_variant']

describe('WebMCP catalog budget', () => {
  it('registers eleven tools whose names, descriptions and schemas fit ChatGPT\'s tool budget with margin', () => {
    expect(webMcpTools.map((tool) => tool.name)).toEqual(expectedNames)
    const budget = catalogBudget(webMcpTools)
    expect(budget.toolCount).toBe(11)
    expect(budget.chars, `catalog is ${budget.chars} chars`).toBeLessThan(CHAR_BUDGET)
    expect(budget.estimatedTokens, `about ${budget.estimatedTokens} tokens`).toBeLessThan(TOKEN_BUDGET * 0.85)
    expect(budget.largest.chars, `${budget.largest.name} is ${budget.largest.chars} chars`).toBeLessThan(LARGEST_TOOL_CHARS)
  })

  it('keeps descriptions short at the root and none below it', () => {
    const nested = (schema: unknown, depth: number): number => {
      if (Array.isArray(schema)) return schema.reduce((sum: number, item) => sum + nested(item, depth), 0)
      if (!schema || typeof schema !== 'object') return 0
      let count = 0
      for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
        if (key === 'description' && depth > 1) count += 1
        if (key === 'properties') for (const property of Object.values(value as Record<string, unknown>)) count += nested(property, depth + 1)
        else if (key === 'items' || key === 'anyOf' || key === 'oneOf' || key === 'allOf') count += nested(value, depth + 1)
      }
      return count
    }
    for (const tool of webMcpTools) {
      expect(tool.description.length, tool.name).toBeLessThanOrEqual(320)
      expect(nested(tool.inputSchema, 0), `${tool.name} carries nested descriptions`).toBe(0)
      expect(JSON.stringify(tool.inputSchema)).not.toContain('"$schema"')
      const properties = (tool.inputSchema?.properties ?? {}) as Record<string, { description?: string }>
      for (const [name, property] of Object.entries(properties)) {
        expect(property.description, `${tool.name}.${name}`).toBeTruthy()
        expect(property.description!.length, `${tool.name}.${name}`).toBeLessThanOrEqual(150)
      }
    }
  })
})
