# 🧪 Tests - Sistema de Gestión de Vacaciones CNI

## 📁 Estructura de Tests

```
tests/
├── setup.ts                    # Configuración global de tests
├── unit/                       # Tests unitarios
│   └── services/              # Tests de servicios de negocio
│       ├── solicitudes.service.test.ts
│       ├── usuarios.service.test.ts
│       ├── reportes.service.test.ts
│       └── balance.service.test.ts
├── integration/               # Tests de integración (futuro)
└── e2e/                       # Tests end-to-end (futuro)
```

## 🚀 Comandos Disponibles

```bash
# Ejecutar todos los tests en modo watch
pnpm test

# Ejecutar tests con UI interactiva
pnpm test:ui

# Ejecutar tests con coverage
pnpm test:coverage

# Ejecutar tests una sola vez (CI)
pnpm test:run
```

## 📊 Objetivos de Coverage

| Servicio | Target Coverage | Prioridad |
|----------|----------------|-----------|
| `solicitudes.service.ts` | >85% | 🔴 Crítico |
| `usuarios.service.ts` | >80% | 🔴 Crítico |
| `balance.service.ts` | >75% | 🟡 Alta |
| `reportes.service.ts` | >70% | 🟢 Media |

## 🛠️ Tecnologías

- **Vitest**: Framework de testing rápido y moderno
- **@testing-library/react**: Testing de componentes React
- **jsdom**: Entorno DOM para tests
- **@vitest/ui**: Interfaz visual para tests
- **@vitest/coverage-v8**: Reporte de coverage

## 📝 Convenciones

### Nomenclatura de Tests

```typescript
describe('NombreDelServicio', () => {
  describe('nombreDeLaFuncion()', () => {
    it('debe hacer X cuando Y', () => {
      // Test
    })
    
    it('debe lanzar error cuando Z', () => {
      // Test de error
    })
  })
})
```

### Estructura de Test

```typescript
// Arrange (Preparar)
const mockData = { ... }
const mockDb = vi.fn()

// Act (Actuar)
const result = await funcionATestear(mockData)

// Assert (Verificar)
expect(result).toBe(expected)
```

## 🎯 Prioridades Semana 2

1. ✅ Setup de Vitest
2. 🔄 Tests de `solicitudes.service.ts` (15+ tests)
3. 🔄 Tests de `usuarios.service.ts` (10+ tests)
4. 🔄 Tests de `reportes.service.ts` (8+ tests)
5. 🔄 Tests de `balance.service.ts` (5+ tests)

## 📚 Recursos

- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Vitest UI](https://vitest.dev/guide/ui.html)
