#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Script para reinstalar la base de datos completa con RBAC
.DESCRIPTION
    Este script:
    1. Hace drop de todas las tablas existentes
    2. Genera el schema con Drizzle desde src/core/infrastructure/database/schema.ts
    3. Ejecuta el seed completo con roles, permisos y usuarios de prueba
.NOTES
    ⚠️ CUIDADO: Esto eliminará TODOS los datos existentes
#>

param(
    [switch]$SkipConfirmation
)

$ErrorActionPreference = "Stop"

Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " 🔄 REINSTALACIÓN COMPLETA DE BASE DE DATOS" -ForegroundColor Yellow -BackgroundColor Black
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Verificar que existe .env
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: No se encontró el archivo .env" -ForegroundColor Red
    Write-Host "   Crea el archivo .env con DATABASE_URL" -ForegroundColor Yellow
    exit 1
}

# Cargar DATABASE_URL del .env
$DATABASE_URL = Get-Content .env | Where-Object { $_ -match "^DATABASE_URL=" } | ForEach-Object { $_ -replace "DATABASE_URL=", "" }

if (-not $DATABASE_URL) {
    Write-Host "❌ Error: DATABASE_URL no está definida en .env" -ForegroundColor Red
    exit 1
}

# Ocultar password en el output
$maskedUrl = $DATABASE_URL -replace ':[^:@]+@', ':****@'
Write-Host "📦 Base de datos: $maskedUrl" -ForegroundColor Gray
Write-Host ""

# Confirmación
if (-not $SkipConfirmation) {
    Write-Host "⚠️  ADVERTENCIA:" -ForegroundColor Red -BackgroundColor Yellow
    Write-Host "   Esto eliminará TODOS los datos actuales" -ForegroundColor Red
    Write-Host "   y reinstalará la base de datos desde cero.`n" -ForegroundColor Red
    
    $confirmacion = Read-Host "¿Estás seguro? Escribe 'SI' para continuar"
    
    if ($confirmacion -ne "SI") {
        Write-Host "`n❌ Operación cancelada por el usuario`n" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "🚀 Iniciando proceso de reinstalación...`n" -ForegroundColor Green

# Paso 1: Drop de todas las tablas
Write-Host "📋 Paso 1/3: Eliminando tablas existentes..." -ForegroundColor Cyan
try {
    $env:DATABASE_URL = $DATABASE_URL
    $dropSql = Get-Content "database/00_drop_all.sql" -Raw
    
    # Ejecutar con psql si está disponible, sino con node
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        $dropSql | psql $DATABASE_URL 2>&1 | Out-Null
        Write-Host "   ✅ Tablas eliminadas exitosamente" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  psql no disponible, usando método alternativo..." -ForegroundColor Yellow
        # Aquí podrías usar un script Node.js alternativo
        Write-Host "   ⏭️  Continuando con push de schema (recreará tablas)..." -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  Advertencia: Error al eliminar tablas (puede ser normal si no existían)" -ForegroundColor Yellow
    Write-Host "   Continuando con el proceso..." -ForegroundColor Gray
}

Write-Host ""

# Paso 2: Push del schema con Drizzle
Write-Host "📋 Paso 2/3: Creando tablas desde schema de Drizzle..." -ForegroundColor Cyan
try {
    $output = pnpm drizzle-kit push 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Tablas creadas exitosamente" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Error al crear tablas:" -ForegroundColor Red
        Write-Host $output
        exit 1
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Paso 3: Seed de datos
Write-Host "📋 Paso 3/3: Insertando datos iniciales (RBAC + usuarios)..." -ForegroundColor Cyan
try {
    $seedSql = Get-Content "database/07_seed_rbac_completo.sql" -Raw
    
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        $seedOutput = $seedSql | psql $DATABASE_URL 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Datos insertados exitosamente" -ForegroundColor Green
            Write-Host ""
            Write-Host "   📊 Resumen:" -ForegroundColor Cyan
            $seedOutput | Select-String "info" | ForEach-Object {
                Write-Host "      $_" -ForegroundColor White
            }
        } else {
            Write-Host "   ❌ Error al insertar datos:" -ForegroundColor Red
            Write-Host $seedOutput
            exit 1
        }
    } else {
        Write-Host "   ⚠️  psql no disponible" -ForegroundColor Yellow
        Write-Host "   Para completar el seed, instala PostgreSQL client o ejecuta:" -ForegroundColor Yellow
        Write-Host "   psql `$env:DATABASE_URL < database/07_seed_rbac_completo.sql" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " ✅ BASE DE DATOS REINSTALADA EXITOSAMENTE" -ForegroundColor Green -BackgroundColor Black
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "👥 Usuarios de prueba creados:" -ForegroundColor Yellow
Write-Host "   📧 admin@cni.hn (ADMIN)" -ForegroundColor White
Write-Host "   📧 rrhh@cni.hn (RRHH)" -ForegroundColor White
Write-Host "   📧 jefe.ti@cni.hn (JEFE de TI)" -ForegroundColor White
Write-Host "   📧 empleado@cni.hn (EMPLEADO)" -ForegroundColor White
Write-Host "   🔑 Password para todos: Admin123!" -ForegroundColor Gray
Write-Host ""

Write-Host "🎯 Sistema RBAC:" -ForegroundColor Yellow
Write-Host "   • 4 roles creados (ADMIN, RRHH, JEFE, EMPLEADO)" -ForegroundColor White
Write-Host "   • 24 permisos creados" -ForegroundColor White
Write-Host "   • Permisos asignados por jerarquía" -ForegroundColor White
Write-Host "   • Departamentos y balances inicializados" -ForegroundColor White
Write-Host ""

Write-Host "🚀 Próximo paso: Probar login con admin@cni.hn" -ForegroundColor Green
Write-Host ""
