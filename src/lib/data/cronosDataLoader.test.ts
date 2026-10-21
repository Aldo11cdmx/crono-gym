import { describe, it, expect } from 'vitest'
import { sanitizeBrandName, getSubstitutions, getAllSubstitutions } from './cronosDataLoader'

describe('cronosDataLoader', () => {
  it('sanitizes Symmetry to Cronos', () => {
    expect(sanitizeBrandName('Symmetry')).toBe('Cronos')
    expect(sanitizeBrandName('Symmetry Intelligence')).toBe('Cronos Intelligence')
    expect(sanitizeBrandName('Deja las rutinas genéricas de copia y pega. Symmetry Intelligence analiza tu perfil')).toContain('Cronos Intelligence')
  })

  it('keeps other text unchanged', () => {
    expect(sanitizeBrandName('Cronos Gym')).toBe('Cronos Gym')
    expect(sanitizeBrandName('Hello World')).toBe('Hello World')
  })

  it('provides substitution utilities', () => {
    const all = getAllSubstitutions()
    expect(typeof all).toBe('object')
    const subs = getSubstitutions('123')
    expect(Array.isArray(subs)).toBe(true)
  })
})
