# Arma el APK firmado de OpenGravity en esta PC y lo copia a Google Drive. La llave no sale de la maquina.
# La contrasena se pide sin mostrarla y solo vive mientras corre este script.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\armar-apk.ps1

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$llave = 'D:\VibeCoding\Llaves\OpenGravity\opengravity.jks'
$salida = Join-Path (Split-Path $repo -Parent) 'APK'
$drive = 'G:\Mi unidad\OpenGravity'

if (-not (Test-Path $llave)) {
    Write-Host "No esta la llave en $llave. Crearla con scripts\crear-llave-firma.ps1." -ForegroundColor Red
    exit 1
}
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot' }

$segura = Read-Host 'Contrasena de la llave de firma (no se ve al escribir)' -AsSecureString
$clave = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura))

$ahora = Get-Date
$env:ANDROID_KEYSTORE_FILE = $llave
$env:ANDROID_KEYSTORE_PASSWORD = $clave
$env:ANDROID_KEY_PASSWORD = $clave
$env:ANDROID_KEY_ALIAS = 'opengravity'
$env:VERSION_CODE = $ahora.ToString('yyMMddHH')
$env:VERSION_APP = '1.0.' + $ahora.ToString('yyMMdd.HHmm')

try {
    Set-Location $repo
    # Reinstalar los componentes si no están o si la lista cambió desde la última vez (por ejemplo, al
    # agregar Filesystem y Share el 19/11/2026). npm deja su copia de la lista en node_modules\.package-lock.json.
    $instalada = 'node_modules\.package-lock.json'
    if (-not (Test-Path $instalada) -or ((Get-Item 'package-lock.json').LastWriteTime -gt (Get-Item $instalada).LastWriteTime)) {
        npm ci
        if ($LASTEXITCODE -ne 0) { throw 'Fallo npm ci' }
    }
    npm run android:sync
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la preparacion de la app (android:sync)' }

    Set-Location (Join-Path $repo 'android')
    .\gradlew.bat --no-daemon assembleRelease
    if ($LASTEXITCODE -ne 0) { throw 'Fallo el armado del APK (gradle)' }

    $apk = Join-Path $repo 'android\app\build\outputs\apk\release\app-release.apk'
    if (-not (Test-Path $apk)) { throw 'No se genero un APK firmado' }
    New-Item -ItemType Directory -Force $salida | Out-Null
    $destino = Join-Path $salida 'OpenGravity.apk'
    Copy-Item $apk $destino -Force
    Write-Host ''
    Write-Host "APK listo: $destino  (version $env:VERSION_APP)" -ForegroundColor Green
    if (Test-Path $drive) {
        Copy-Item $apk (Join-Path $drive 'OpenGravity.apk') -Force
        Write-Host "Copiado a Google Drive: $drive\OpenGravity.apk (puede tardar un minuto en sincronizar)" -ForegroundColor Green
    } else {
        Write-Host "No encontre la carpeta de Drive ($drive): copia el APK a mano." -ForegroundColor Yellow
    }
}
catch {
    Write-Host $_ -ForegroundColor Red
    exit 1
}
finally {
    Set-Location $repo
    $clave = $null
    Remove-Item Env:ANDROID_KEYSTORE_PASSWORD, Env:ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
}
