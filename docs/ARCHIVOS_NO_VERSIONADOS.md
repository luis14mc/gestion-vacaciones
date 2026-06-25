# Archivos que no se suben a Git

Este documento lista los archivos y carpetas que **nunca deben versionarse** en el repositorio. Contienen secretos, credenciales o datos locales de cada desarrollador.

## Regla general

- Lo que **sí** va a Git: plantillas con placeholders (`.env.example`, `.env.test.example`, `.env.production.example`).
- Lo que **no** va a Git: copias locales con valores reales (`.env.local`, `.env.test`, `.env.production`).

Si accidentalmente subiste un secreto, **rótalo de inmediato** en el proveedor (Neon, SMTP, etc.) y elimínalo del historial de Git si aplica.

---

## Variables de entorno

| Archivo | Propósito | ¿En Git? |
|---------|-----------|----------|
| `.env.example` | Plantilla desarrollo local | Sí |
| `.env.local` | Tu BD y secretos de desarrollo | **No** |
| `.env.test.example` | Plantilla para tests de integración | Sí |
| `.env.test` | BD real para `pnpm test:integration:run` | **No** |
| `.env.production.example` | Plantilla despliegue Docker/EC2 | Sí |
| `.env.production` | Secretos de producción | **No** |
| `.env` | Atajo genérico (si existe) | **No** |

Todos estos archivos locales están listados en `.gitignore`.

---

## Neon (solo desarrollo local)

**Neon** es una base PostgreSQL en la nube que algunos desarrolladores usan **únicamente en su máquina** para pruebas o integración, sin compartir credenciales en el repo.

- La URL de Neon (`postgresql://...@...neon.tech/...`) va **solo** en `.env.local` o `.env.test` en tu PC.
- **No** commits URLs de Neon, contraseñas ni `AUTH_SECRET` reales.
- Producción usa PostgreSQL en Docker/EC2 (ver `.env.production.example`), no Neon.

### Configurar tests con Neon en local

```bash
cp .env.test.example .env.test
# Editar .env.test con tu DATABASE_URL / DATABASE_URL_TEST de Neon
pnpm test:integration:run
```

El archivo `.env.test` queda ignorado por Git; cada desarrollador mantiene el suyo.

---

## Otros archivos ignorados

| Patrón | Motivo |
|--------|--------|
| `node_modules/` | Dependencias (se instalan con `pnpm install`) |
| `.next/`, `out/`, `build/` | Artefactos de build |
| `.vercel/` | Config local de Vercel |
| `*.pem` | Claves privadas TLS/SSH |
| `coverage/` | Reportes de cobertura de tests |
| `*.tsbuildinfo` | Caché de TypeScript |

---

## Checklist antes de `git push`

1. `git status` — no debe aparecer `.env.local`, `.env.test` ni `.env.production`.
2. Revisar el diff: sin contraseñas, tokens SMTP ni URLs con credenciales embebidas.
3. Si usas Neon local, confirma que la URL solo está en archivos ignorados.

---

## Referencias

- [`.env.example`](../.env.example) — desarrollo
- [`.env.test.example`](../.env.test.example) — tests de integración
- [`.env.production.example`](../.env.production.example) — producción
- [`.gitignore`](../.gitignore) — lista autoritativa de exclusiones
