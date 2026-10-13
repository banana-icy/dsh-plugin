import { describe, expect, it } from 'vitest'
import { apply, name } from '../src/index.ts'

describe('dsh-esc-pause host half', () => {
  it('names the cordis row and registers no host behavior', () => {
    expect(name).toBe('dsh-esc-pause')
    expect(apply()).toBeUndefined()
  })
})