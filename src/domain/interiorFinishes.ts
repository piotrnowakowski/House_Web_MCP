import { z } from 'zod'
import type { InteriorFinish } from './types'

/** Interior presets use the existing CC0 scans at their physical scale. */
export const interiorFinishes = [
  { id: 'warm-white', name: 'Warm white', color: '#f2eee5', texture: null, tileM: 1, roughness: 0.86 },
  { id: 'chalk', name: 'Chalk', color: '#faf9f5', texture: null, tileM: 1, roughness: 0.9 },
  { id: 'sage', name: 'Soft sage', color: '#a2b09d', texture: null, tileM: 1, roughness: 0.85 },
  { id: 'clay', name: 'Clay', color: '#bb947d', texture: null, tileM: 1, roughness: 0.88 },
  { id: 'charcoal', name: 'Charcoal', color: '#424944', texture: null, tileM: 1, roughness: 0.8 },
  { id: 'light-wood', name: 'Pale wood', color: '#f3e8d3', texture: 'hinoki', tileM: 1.9, roughness: 0.7 },
  { id: 'warm-wood', name: 'Warm wood', color: '#d7b17d', texture: 'coated-pine', tileM: 0.7, roughness: 0.65 },
  { id: 'dark-wood', name: 'Dark wood', color: '#836348', texture: 'coated-pine', tileM: 0.7, roughness: 0.65 },
  { id: 'concrete', name: 'Concrete', color: '#dad8d2', texture: 'concrete-tiles', tileM: 1.8, roughness: 0.9 },
  { id: 'tile', name: 'Ceramic tile', color: '#efede5', texture: 'square-tiles', tileM: 2.4, roughness: 0.45 },
  { id: 'linen', name: 'Linen', color: '#d8ccba', texture: 'linen', tileM: 0.4, roughness: 0.98 },
  { id: 'jute', name: 'Woven jute', color: '#bfa379', texture: 'jute', tileM: 0.5, roughness: 1 },
] as const

export const InteriorFinishSchema = z.object({
  presetId: z
    .string()
    .refine((id) => interiorFinishes.some((preset) => preset.id === id), 'Choose an interior finish.'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  rotationDegrees: z.number().finite(),
  tileM: z.number().min(0.05).max(20),
})

export function finishFromPreset(id: string): InteriorFinish {
  const preset = interiorFinishes.find((entry) => entry.id === id) ?? interiorFinishes[0]
  return { presetId: preset.id, color: preset.color, rotationDegrees: 0, tileM: preset.tileM }
}
