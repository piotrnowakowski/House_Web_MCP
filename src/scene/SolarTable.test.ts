import { isValidElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { gardenFixtureById } from '../domain/gardenFixtures'
import { SolarTable } from './GardenStructures'

it('renders the actual module count and footprint for both table sizes', () => {
  for (const columns of [5, 10] as const) {
    const modules: { position: number[]; userData: { solarModulePowerW: number } }[] = []
    const visit = (node: ReactNode) => {
      if (Array.isArray(node)) { node.forEach(visit); return }
      if (!isValidElement<{ children?: ReactNode; position?: number[]; userData?: { solarModulePowerW: number } }>(node)) return
      if (node.props.position && node.props.userData) modules.push({ position: node.props.position, userData: node.props.userData })
      visit(node.props.children)
    }
    visit(SolarTable({ columns, selected: false, ghost: false }))
    expect(modules).toHaveLength(columns * 2)
    expect(modules.reduce((sum, m) => sum + m.userData.solarModulePowerW, 0)).toBe(columns * 1000)
    const width = Math.max(...modules.map(m => m.position[0])) - Math.min(...modules.map(m => m.position[0])) + 1.134
    expect(width).toBeCloseTo(gardenFixtureById(columns === 5 ? 'solar-table-10' : 'solar-table-20').widthM, 10)
  }
})
