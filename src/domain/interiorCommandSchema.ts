import { z } from 'zod'
import { InteriorItemSchema } from './interior'
import { InteriorFinishSchema } from './interiorFinishes'

const ref = z.string().min(1)
const point = z.object({ x: z.number().finite(), z: z.number().finite() }).strict()
const base = { type: z.literal('interior.update'), buildingRef: ref, storeyRef: ref }
export const interiorCommandSchema = z.discriminatedUnion('action', [
  z.object({ ...base, action: z.literal('wall-group'), wallRefs: z.array(ref).min(1).max(100), groupRef: ref.nullable() }).strict(),
  z.object({ ...base, action: z.literal('walls-move'), wallRefs: z.array(ref).min(1).max(100), delta: point }).strict(),
  z.object({ ...base, action: z.literal('put'), item: InteriorItemSchema.strict() }).strict(),
  z.object({ ...base, action: z.literal('remove'), itemRef: ref }).strict(),
  z
    .object({ ...base, action: z.literal('lock'), itemRefs: z.array(ref).min(1).max(100), locked: z.boolean() })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal('room'),
      spaceRef: ref,
      name: z.string().trim().min(1).max(100),
      usage: z.string().max(100).optional(),
      widthM: z.number().min(1).max(50).optional(),
      depthM: z.number().min(1).max(50).optional(),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal('split'),
      spaceRef: ref,
      start: point,
      end: point,
      partitionRef: ref,
      newSpaceRef: ref,
      name: z.string().trim().min(1).max(100),
      thicknessM: z.number().min(0.06).max(0.5),
    })
    .strict(),
  z.object({ ...base, action: z.literal('merge'), wallRef: ref }).strict(),
  z
    .object({
      ...base,
      action: z.literal('wall'),
      wallRef: ref,
      start: point,
      end: point,
      thicknessM: z.number().min(0.06).max(0.5).optional(),
      heightM: z.number().positive().optional(),
    })
    .strict(),
  z
    .object({
      ...base,
      action: z.literal('opening'),
      wallRef: ref,
      opening: z
        .object({
          ref,
          wallRef: ref,
          kind: z.enum(['door', 'window']),
          glazed: z.boolean().optional(),
          offsetM: z.number().min(0),
          widthM: z.number().min(0.2),
          heightM: z.number().min(0.2),
          sillM: z.number().min(0),
          hinge: z.enum(['left', 'right']).optional(),
          swing: z.enum(['in', 'out']).optional(),
        })
        .strict(),
    })
    .strict(),
  z.object({ ...base, action: z.literal('opening-remove'), wallRef: ref, openingRef: ref }).strict(),
  z
    .object({
      ...base,
      action: z.literal('finish'),
      targetRef: ref,
      surface: z.enum(['floor', 'ceiling', 'left', 'right']),
      finish: InteriorFinishSchema.strict(),
    })
    .strict(),
])
