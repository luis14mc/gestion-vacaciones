# Script para crear balances de prueba via API
# Día 2, Actividad 2.2

$baseUrl = "http://localhost:3000/api"

Write-Host "`n🔧 CREANDO DATOS DE PRUEBA PARA ACTIVIDAD 2.2" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Función para login
function Get-AuthSession {
    param($email, $password)
    
    $loginBody = @{
        email = $email
        password = $password
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/auth/callback/credentials" `
            -Method POST `
            -Body $loginBody `
            -ContentType "application/json" `
            -SessionVariable session `
            -ErrorAction Stop

        return $session
    } catch {
        Write-Host "❌ Error en login: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# 1. Login como Admin
Write-Host "`n1️⃣  Conectando como ADMIN..." -ForegroundColor Yellow
$adminSession = Get-AuthSession -email "admin@cni.hn" -password "Admin123!"

if ($null -eq $adminSession) {
    Write-Host "❌ No se pudo conectar como admin. Verifica que el servidor esté corriendo." -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Sesión admin obtenida" -ForegroundColor Green

# 2. Verificar tipos de ausencia disponibles
Write-Host "`n2️⃣  Verificando tipos de ausencia..." -ForegroundColor Yellow
try {
    $tiposResponse = Invoke-WebRequest -Uri "$baseUrl/tipos-ausencia" `
        -Method GET `
        -WebSession $adminSession `
        -ErrorAction Stop

    $tipos = ($tiposResponse.Content | ConvertFrom-Json).data
    $tipoVacaciones = $tipos | Where-Object { $_.tipo -eq 'vacaciones' } | Select-Object -First 1
    
    if ($null -eq $tipoVacaciones) {
        Write-Host "   ❌ No se encontró tipo 'vacaciones'" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "   ✅ Tipo Vacaciones ID: $($tipoVacaciones.id)" -ForegroundColor Green
    $tipoAusenciaId = $tipoVacaciones.id
} catch {
    Write-Host "   ❌ Error obteniendo tipos: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Verificar usuarios
Write-Host "`n3️⃣  Verificando usuarios de prueba..." -ForegroundColor Yellow

$usuarios = @(
    @{ email = "admin@cni.hn"; id = 1; dias = 20 },
    @{ email = "rrhh@cni.hn"; id = 2; dias = 20 },
    @{ email = "jefe.tecnologia@cni.hn"; id = 3; dias = 15 },
    @{ email = "empleado@cni.hn"; id = 4; dias = 15 }
)

foreach ($usuario in $usuarios) {
    Write-Host "   • $($usuario.email) (ID: $($usuario.id))" -ForegroundColor Gray
}

# 4. Crear/actualizar balances usando API
Write-Host "`n4️⃣  Creando balances de vacaciones para 2026..." -ForegroundColor Yellow

# Nota: Como no tenemos endpoint directo para crear balances,
# vamos a usar SQL directo via script o crear un endpoint temporal

Write-Host "`n📋 INSTRUCCIONES:" -ForegroundColor Cyan
Write-Host "   Para crear los balances, ejecuta en Neon SQL Editor:" -ForegroundColor White
Write-Host "   > scripts/seed-balances-testing.sql" -ForegroundColor Yellow
Write-Host "`n   O copia este SQL (tipo_ausencia_id = $tipoAusenciaId):" -ForegroundColor White
Write-Host "   Ver archivo: scripts/seed-balances-testing.sql" -ForegroundColor Gray

Write-Host "`n5️⃣  Verificando balances actuales via API..." -ForegroundColor Yellow

foreach ($usuario in $usuarios) {
    try {
        # Login con cada usuario para verificar su balance
        $session = Get-AuthSession -email $usuario.email -password "Admin123!"
        
        if ($null -ne $session) {
            $balanceResponse = Invoke-WebRequest -Uri "$baseUrl/dashboard/mi-balance" `
                -Method GET `
                -WebSession $session `
                -ErrorAction SilentlyContinue

            if ($balanceResponse.StatusCode -eq 200) {
                $balance = ($balanceResponse.Content | ConvertFrom-Json).data
                
                if ($null -ne $balance) {
                    Write-Host "   ✅ $($usuario.email): $($balance.diasDisponibles) días disponibles" -ForegroundColor Green
                } else {
                    Write-Host "   ⚠️  $($usuario.email): Sin balance creado" -ForegroundColor Yellow
                }
            } else {
                Write-Host "   ⚠️  $($usuario.email): Sin balance" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "   ⚠️  $($usuario.email): Error verificando balance" -ForegroundColor Yellow
    }
}

Write-Host "`n✅ VERIFICACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "`n📝 Siguiente paso:" -ForegroundColor Cyan
Write-Host "   1. Si falta crear balances, ejecutar SQL en Neon" -ForegroundColor White
Write-Host "   2. Ejecutar pruebas: .\tests\test-crear-solicitud-rbac.http" -ForegroundColor White
Write-Host ""
