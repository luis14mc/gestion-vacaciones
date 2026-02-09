# 🎯 BASE DE DATOS CNI - UN SOLO COMANDO

## ⚡ Instalación Completa Automática

```powershell
pnpm db:install
```

**Ejecuta TODO:**
1. ✅ RESET completo de la base de datos
2. ✅ Crea 12 tablas + 5 enums + 45 índices
3. ✅ Instala 3 funciones PostgreSQL + 6 triggers
4. ✅ Seed con 5 usuarios, 4 roles, 18 permisos, 5 departamentos

**Tiempo:** ~10 segundos

---

## 🔐 Credenciales

| Email            | Password | Rol      |
|------------------|----------|----------|
| admin@cni.cl     | Test123! | Admin    |
| rrhh@cni.cl      | Test123! | RRHH     |
| jefe.ti@cni.cl   | Test123! | Jefe TI  |
| ana.dev@cni.cl   | Test123! | Dev      |
| luis.ops@cni.cl  | Test123! | Ops      |

---

## 🗄️ Estructura Creada

### Tablas (12)
- `usuarios`, `roles`, `permisos`, `usuarios_roles`, `roles_permisos`
- `departamentos`, `usuarios_departamentos`
- `anos_laborales`, `solicitudes`
- `balances`, `historial_balances`
- `sessions`

### Enums (5)
- `tipo_solicitud`: vacaciones | permiso_salida | licencia_medica | permiso_personal | licencia_paternidad | compensacion
- `duracion_permiso`: 1-2h | 2-4h | dia_completo  
- `estado_solicitud`: 12 estados (borrador → aprobada_ejecutiva → finalizada)
- `tipo_ausencia`: 7 tipos
- `tipo_movimiento`: 7 tipos

### Funciones PostgreSQL (3)
- `generar_codigo_cni_solicitud(ano)` → CNI-SOL-YYYY-XXXX
- `actualizar_cantidad_disponible_balance()` → Trigger automático
- `actualizar_updated_at()` → Trigger updated_at

### Triggers (6)
- Balance disponible auto-calculado
- Updated_at en 6 tablas

---

## 🚀 Iniciar Desarrollo

```powershell
pnpm dev
```

Abre: http://localhost:3000

---

## 📊 Datos Iniciales

### Usuarios (5)
- 1 Admin (sin departamento)
- 1 RRHH (departamento RRHH)
- 1 Jefe (departamento TI)
- 2 Empleados (TI y Ops)

### Balances
- 15 días de vacaciones asignados a cada usuario para 2026

### Departamentos (5)
- TI, RRHH, OPS, LOG, ADMIN

---

## 🔄 Reinstalar BD

Si necesitas volver a instalar desde cero:

```powershell
pnpm db:install
```

**Advertencia:** Borra TODO y reinstala limpio.

---

## 📁 Archivos del Sistema

```
scripts/
└── install-database.mjs    # Script de instalación completa

database/
├── HARD_RESET.sql          # SQL para reset manual (si necesitas)
├── 09_cni_business_logic.sql   # Triggers y funciones
└── validate-cni-schema.sql     # Validación

drizzle/
└── 0000_nappy_viper.sql    # Migración auto-generada

src/lib/db/schema/
├── auth.ts                 # Auth & RBAC (6 tablas)
├── organizacion.ts         # Departamentos (2 tablas)
├── solicitudes.ts          # CNI Core (2 tablas)
└── balances.ts             # Balances (2 tablas)
```

---

## 📖 Documentación Completa

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Guía detallada paso a paso
- [DEPLOYMENT_SIMPLE.md](DEPLOYMENT_SIMPLE.md) - Versión resumida

---

## ⚙️ Otros Comandos

```powershell
# Ver base de datos en Drizzle Studio
pnpm db:studio

# Solo seed (sin reset)
pnpm db:seed

# Generar nueva migración (después de cambiar schemas)
pnpm drizzle-kit generate
```

---

## ✅ Verificar Instalación

Después de `pnpm db:install`, deberías ver:

```
🎉 ¡BASE DE DATOS LISTA!
```

Y la tabla con las 5 credenciales de acceso.

---

**¿Problemas?** Verifica que `DATABASE_URL` esté configurada en `.env`
