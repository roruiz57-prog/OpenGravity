# Crea la llave de firma del APK de OpenGravity, FUERA del repositorio.
# Las contrasenas las pide keytool en la terminal, sin mostrarlas. Nunca pasan por el chat.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\crear-llave-firma.ps1

$ErrorActionPreference = 'Stop'
$carpeta = 'D:\VibeCoding\Llaves\OpenGravity'
$llave = Join-Path $carpeta 'opengravity.jks'

if (Test-Path $llave) {
    Write-Host "Ya existe una llave en $llave. No se toca: reemplazarla impediria actualizar el APK instalado." -ForegroundColor Red
    exit 1
}

$keytool = (Get-Command keytool -ErrorAction SilentlyContinue).Source
if (-not $keytool) {
    Write-Host 'No se encontro keytool (Java). Instalar Temurin 21 desde adoptium.net.' -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force $carpeta | Out-Null

Write-Host ''
Write-Host 'Se va a pedir una contrasena (dos veces). Elegi una larga y anotala en tu gestor de contrasenas.' -ForegroundColor Cyan
Write-Host 'Mientras la escribis no se ve nada en pantalla: es normal.' -ForegroundColor Cyan
Write-Host ''

& $keytool -genkeypair -keystore $llave -storetype PKCS12 -alias opengravity `
    -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=OpenGravity Diagramas'

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $llave)) {
    Write-Host 'No se creo la llave.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host "Llave creada en: $llave" -ForegroundColor Green
Write-Host 'Alias: opengravity. La contrasena de la llave es la misma que la del almacen.' -ForegroundColor Green
Write-Host 'Ahora guarda una copia del archivo .jks y la contrasena en tu gestor de contrasenas.' -ForegroundColor Yellow
