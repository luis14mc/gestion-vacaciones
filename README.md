# Sistema de Gestión de Vacaciones y Permisos - CNI

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue?logo=postgresql)](https://www.postgresql.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

Sistema web integral para la gestión de solicitudes de vacaciones, permisos y licencias laborales del Consejo Nacional de Inversiones (CNI), Honduras.

Esta plataforma automatiza y centraliza el flujo de aprobación de ausencias, conectando a Empleados, Jefes de Departamento y Recursos Humanos en un entorno seguro y en tiempo real.

---

## 🚀 Características Principales

- **Gestión de Solicitudes:** Creación y seguimiento de vacaciones, permisos por horas y licencias médicas con soporte para adjuntos.
- **Flujo de Aprobación Jerárquico:** Múltiples niveles de revisión (Jefe Inmediato → Recursos Humanos → Aprobación Ejecutiva).
- **Control Automático de Saldos:** Cálculo y descuento dinámico de días hábiles basado en el Código de Trabajo y la antigüedad del empleado.
- **Roles y Permisos (RBAC):** Accesos y vistas personalizadas según el cargo (Administrador, RRHH, Director, Jefe, Empleado).
- **Reportes y Auditoría:** Exportación de datos a Excel/PDF y registro detallado de todas las transacciones del sistema.

---

## 💻 Tecnologías

- **Frontend:** Next.js (App Router), React, Tailwind CSS, shadcn/ui.
- **Backend:** API Routes (Next.js), NextAuth.js v5.
- **Base de Datos:** PostgreSQL gestionado a través de Drizzle ORM.
- **Validaciones:** Zod y React Hook Form.

---

## ⚙️ Instalación y Despliegue

### Requisitos

- Node.js 18+
- PostgreSQL 16+
- Gestor de paquetes `pnpm`

### Pasos

```bash
# 1. Clonar e instalar dependencias
git clone <repo-url>
cd gestion-vacaciones
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env.local

# 3. Inicializar base de datos
pnpm db:push
pnpm db:seed

# 4. Iniciar en entorno de desarrollo
pnpm dev
```

---

## 📄 Licencia

Proyecto desarrollado y mantenido como propiedad intelectual exclusiva del **Consejo Nacional de Inversiones (CNI) - Honduras, 2026**.
