import { describe, it, expect } from 'vitest'

describe('Setup de Testing', () => {
  it('debe ejecutar tests correctamente', () => {
    expect(true).toBe(true)
  })

  it('debe tener acceso a variables de entorno', () => {
    expect(process.env.DATABASE_URL).toBeDefined()
    expect(process.env.AUTH_SECRET).toBeDefined()
  })

  it('debe poder hacer operaciones matemáticas', () => {
    const suma = 2 + 2
    expect(suma).toBe(4)
  })
})
