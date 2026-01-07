# Base de Datos - Sistema de Gestión de Vacaciones v2.0

## 🚀 Instalación Rápida con pgAdmin

### Paso 1: Crear Base de Datos
1. Abre **pgAdmin 4**
2. Conecta a tu servidor PostgreSQL local
3. Click derecho en "Databases" → Create → Database
4. Nombre: `gestion_vacaciones`
5. Owner: tu usuario (ej: `postgres`)
6. Save

### Paso 2: Ejecutar Scripts
Abre **Query Tool** (F5) en la base de datos creada y ejecuta **EN ORDEN**:

```
1. 01_tipos_enums.sql        ← Tipos ENUM
2. 02_tablas_principales.sql  ← Tablas base
3. 03_balances_solicitudes.sql ← Balances y solicitudes
4. 04_vistas_funciones.sql    ← Vistas y funciones
5. 05_datos_iniciales.sql     ← Datos de prueba
```

**Para cada archivo:**
- Abre el archivo en Query Tool
- Selecciona todo (Ctrl+A)
- Ejecuta (F5 o botón ▶)
- Espera mensaje de éxito
- Continúa con el siguiente

## ✅ Verificación

Después de ejecutar todos los scripts:

```sql
-- Ver tablas creadas (debe mostrar 13+)
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Ver usuarios de prueba (debe mostrar 2)
SELECT email, nombre, apellido FROM usuarios;

-- Ver tipos de ausencia (debe mostrar 8)
SELECT nombre, tipo FROM tipos_ausencia_config;

-- Ver balances (debe mostrar 6)
SELECT COUNT(*) FROM balances_ausencias;
```

## 👤 Usuarios de Prueba

| Email | Contraseña | Roles |
|-------|-----------|-------|
| admin@cni.hn | Admin123! | Admin + RRHH + Jefe |
| rrhh@cni.hn | RRHH123! | RRHH + Jefe |

## 📊 Estructura

### Tablas Principales (8)
- `departamentos` - Organización
- `usuarios` - Empleados
- `tipos_ausencia_config` - 8 tipos de ausencias
- `balances_ausencias` - Balance por usuario/tipo/año
- `solicitudes` - Solicitudes (particionada)
- `historial_balances` - Auditoría (particionada)
- `configuracion_sistema` - Configuración
- `auditoria_cambios` - Log (particionada)

### Vistas (2)
- `v_solicitudes_completas` - Solicitudes con joins
- `v_balances_actuales` - Balances del año actual

### Funciones (2)
- `obtener_balance_usuario()` - Obtiene balance
- `verificar_disponibilidad()` - Verifica si puede solicitar

## 🔗 Conexión desde Next.js

Actualiza `.env.local`:

```env
DATABASE_URL="postgresql://postgres:tu_password@localhost:5432/gestion_vacaciones"
```

## 🗑️ Reinstalar

Si necesitas empezar de cero:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Luego ejecuta los 5 scripts de nuevo.

## 🆘 Problemas Comunes

**Error: "type already exists"**
- Ya ejecutaste el archivo 01. Borra la BD y empieza de nuevo.

**Error: "relation does not exist"**
- No ejecutaste los scripts en orden. Empieza desde el 01.

**Error: "permission denied"**
- Usa el usuario `postgres` o un superusuario.

---

**¿Listo?** Ejecuta los 5 scripts en orden y tendrás la BD lista en 2 minutos.
