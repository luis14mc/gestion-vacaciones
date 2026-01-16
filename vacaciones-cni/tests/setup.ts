import { vi, afterEach } from 'vitest'
import '@testing-library/react'

// Mock de variables de entorno necesarias para tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.AUTH_SECRET = 'test-secret-key-for-testing-only'
process.env.AUTH_URL = 'http://localhost:3000'

// Mock global de fetch si es necesario
global.fetch = vi.fn()

// Mock de next-auth
vi.mock('next-auth', () => ({
  default: vi.fn(),
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock de Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

// Cleanup después de cada test
afterEach(() => {
  vi.clearAllMocks()
})
