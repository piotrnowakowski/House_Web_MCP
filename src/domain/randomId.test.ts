import { afterEach, expect, it, vi } from 'vitest'
import { randomId } from './randomId'

afterEach(() => vi.unstubAllGlobals())

it('creates a valid UUID v4 when HTTP omits crypto.randomUUID', () => {
  const getRandomValues = vi.fn((bytes: Uint8Array) => {
    bytes.forEach((_, index) => { bytes[index] = index })
    return bytes
  })
  vi.stubGlobal('crypto', { getRandomValues })
  expect(randomId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  expect(getRandomValues).toHaveBeenCalledOnce()
})

it('uses native secure-context UUID generation when available', () => {
  const native = vi.fn(() => '8cfb0eb0-bfa4-4ce5-8aef-052c6edeb091')
  vi.stubGlobal('crypto', { randomUUID: native })
  expect(randomId()).toBe('8cfb0eb0-bfa4-4ce5-8aef-052c6edeb091')
})
