# ✅ LISTO PARA DEPLOYMENT

## 🧹 Estructura Limpia

### database/
- ✅ `HARD_RESET.sql` → Reset completo
- ✅ `09_cni_business_logic.sql` → Triggers y funciones
- ✅ `validate-cni-schema.sql` → Validación

### drizzle/
- ✅ `0000_nappy_viper.sql` → Migración auto-generada

### scripts/
- ✅ `seed-database.ts` → Seed actualizado

### src/lib/db/schema/
- ✅ `index.ts` → Exportaciones
- ✅ `auth.ts` → Auth & RBAC (6 tablas)
- ✅ `organizacion.ts` → Departamentos (2 tablas)
- ✅ `solicitudes.ts` → CNI Core (2 tablas)
- ✅ `balances.ts` → Balances (2 tablas)

---

## 📋 EJECUTAR EN ORDEN

### 1️⃣ RESET BD (Manual - Neon Dashboard)
Abrir: https://console.neon.tech → SQL Editor

Copiar y ejecutar contenido de: **`database/HARD_RESET.sql`**

---

### 2️⃣ MIGRACIÓN (Manual - Neon Dashboard)
En el mismo SQL Editor de Neon:

Copiar y ejecutar contenido de: **`drizzle/0000_nappy_viper.sql`**

**Resultado:** 12 tablas + 5 enums + 44 índices

---

### 3️⃣ BUSINESS LOGIC (Manual - Neon Dashboard)
En el mismo SQL Editor de Neon:

Copiar y ejecutar contenido de: **`database/09_cni_business_logic.sql`**

**Resultado:** 3 funciones + 8 triggers

---

### 4️⃣ SEED (Terminal)
```powershell
pnpm tsx scripts/seed-database.ts
```

**Resultado:**
- 4 roles
- 18 permisos
- 5 departamentos
- 5 usuarios
- 1 año laboral 2026
- 5 balances (15 días c/u)

---

### 5️⃣ VALIDAR (Opcional - Neon Dashboard)
Copiar y ejecutar contenido de: **`database/validate-cni-schema.sql`**

---

## 🔐 URLs & Credenciales

### Neon Console
https://console.neon.tech

### Usuarios de Prueba
| Email            | Pass     | Rol      |
|------------------|----------|----------|
| admin@cni.cl     | Test123! | Admin    |
| rrhh@cni.cl      | Test123! | RRHH     |
| jefe.ti@cni.cl   | Test123! | Jefe TI  |
| ana.dev@cni.cl   | Test123! | Dev      |
| luis.ops@cni.cl  | Test123! | Ops      |

---

## 🚀 Iniciar Desarrollo

```powershell
pnpm dev
```

http://localhost:3000

---

## ⚠️ Archivos Eliminados (Obsoletos)

### database/ ❌
- 00_drop_all.sql → 08_seed_rbac_completo.sql
- RESET_DATABASE.sql
- README.md

### scripts/ ❌
- deploy-*.ps1 (todos)
- hard-reset.ps1
- recreate-database.*
- drop-all-*.*
- seed.ts, seed-db.ps1

---

## 📖 Documentación Completa

Ver: **`DEPLOYMENT_GUIDE.md`** (guía detallada)
Ver: **`DEPLOYMENT_SIMPLE.md`** (guía resumida)
