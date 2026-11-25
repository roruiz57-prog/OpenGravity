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

# --- Traer lo ultimo de GitHub antes de armar (agregado el 20/11/2026: ese dia se armo un APK viejo) ---
function Parar($mensaje) {
    Write-Host ''
    Write-Host $mensaje -ForegroundColor Red
    Write-Host 'No se armo nada.' -ForegroundColor Red
    exit 1
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Parar 'No encuentro Git en esta PC.' }
Set-Location $repo
$rama = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Revisando GitHub (rama $rama)..." -ForegroundColor Cyan

# 1) Cambios en la PC que no estan guardados en git: no se arma, para no mezclar ni perder nada.
$pendientes = git status --porcelain --untracked-files=no
if ($pendientes) {
    Write-Host 'Hay archivos cambiados en la PC que no se subieron a GitHub:' -ForegroundColor Yellow
    $pendientes | ForEach-Object { Write-Host "   $_" }
    Parar 'Pedile a Claude Code que los suba (o los descarte) y volve a armar.'
}

# 2) Traer lo ultimo.
git fetch --quiet origin
if ($LASTEXITCODE -ne 0) {
    Write-Host 'No pude conectarme con GitHub (sin internet o sin permiso).' -ForegroundColor Yellow
    $resp = Read-Host 'Armar igual con lo que ya esta en la PC? (s/n)'
    if ($resp -notmatch '^[sS]') { Parar 'Cancelado.' }
} else {
    $remota = "origin/$rama"
    git rev-parse --verify --quiet "refs/remotes/$remota" | Out-Null
    if ($LASTEXITCODE -ne 0) { Parar "La rama $rama no existe en GitHub. Pedile ayuda a Claude Code." }
    $cuentas = (git rev-list --left-right --count "HEAD...$remota").Trim() -split '\s+'
    $soloPC = [int]$cuentas[0]; $soloGitHub = [int]$cuentas[1]
    if ($soloPC -gt 0) {
        Parar "La PC tiene $soloPC cambio(s) guardado(s) que no estan en GitHub. Pedile a Claude Code que los suba y volve a armar."
    }
    if ($soloGitHub -gt 0) {
        $antes = (Get-FileHash $PSCommandPath).Hash
        git merge --ff-only --quiet $remota
        if ($LASTEXITCODE -ne 0) { Parar 'No pude traer lo ultimo de GitHub. Pedile ayuda a Claude Code.' }
        Write-Host "Traje $soloGitHub cambio(s) nuevo(s) de GitHub." -ForegroundColor Green
        # Si este mismo script cambio, correr la version nueva en lugar de esta.
        if (-not $env:OPENGRAVITY_RELANZADO -and (Get-FileHash $PSCommandPath).Hash -ne $antes) {
            Write-Host 'El script de armado se actualizo; uso la version nueva.' -ForegroundColor Cyan
            $env:OPENGRAVITY_RELANZADO = '1'
            & powershell -ExecutionPolicy Bypass -File $PSCommandPath
            exit $LASTEXITCODE
        }
    } else {
        Write-Host 'La PC ya tenia lo ultimo de GitHub.' -ForegroundColor Green
    }
}
Write-Host ''
Write-Host 'Se va a armar con este ultimo cambio:' -ForegroundColor Cyan
Write-Host ('   ' + (git log -1 '--date=format:%d/%m/%Y %H:%M' '--format=%s  (%cd)')) -ForegroundColor White
Write-Host ''

if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot' }

# Cuadro de Windows para la contrasena: tapada con puntos, pero admite pegar (Ctrl+V o clic derecho),
# que Read-Host -AsSecureString no permite. No se guarda en ningun archivo ni en el historial.
function Pedir-Clave {
    Add-Type -AssemblyName System.Windows.Forms
    $form = New-Object Windows.Forms.Form
    $form.Text = 'Armar APK de OpenGravity'
    $form.ClientSize = New-Object Drawing.Size(360, 110)
    $form.FormBorderStyle = 'FixedDialog'
    $form.StartPosition = 'CenterScreen'
    $form.MaximizeBox = $false; $form.MinimizeBox = $false; $form.TopMost = $true
    $texto = New-Object Windows.Forms.Label
    $texto.Text = 'Contrasena de la llave de firma (se puede pegar):'
    $texto.SetBounds(12, 12, 336, 20)
    $campo = New-Object Windows.Forms.TextBox
    $campo.UseSystemPasswordChar = $true
    $campo.SetBounds(12, 36, 336, 24)
    $aceptar = New-Object Windows.Forms.Button
    $aceptar.Text = 'Armar'; $aceptar.DialogResult = 'OK'; $aceptar.SetBounds(192, 72, 75, 26)
    $cancelar = New-Object Windows.Forms.Button
    $cancelar.Text = 'Cancelar'; $cancelar.DialogResult = 'Cancel'; $cancelar.SetBounds(273, 72, 75, 26)
    $form.Controls.AddRange(@($texto, $campo, $aceptar, $cancelar))
    $form.AcceptButton = $aceptar; $form.CancelButton = $cancelar
    $form.Add_Shown({ $form.Activate(); $campo.Focus() })
    $respuesta = $form.ShowDialog()
    $valor = $campo.Text
    $form.Dispose()
    if ($respuesta -ne 'OK' -or -not $valor) { return $null }
    # Si se pego, no dejar la contrasena en el portapapeles (solo se borra si es exactamente ella).
    try {
        if ([Windows.Forms.Clipboard]::ContainsText() -and [Windows.Forms.Clipboard]::GetText() -eq $valor) {
            [Windows.Forms.Clipboard]::Clear()
        }
    } catch { }
    return $valor
}
Write-Host 'Escribi o pega la contrasena en el cuadro que se abrio.' -ForegroundColor Cyan
$clave = Pedir-Clave
if (-not $clave) { Parar 'Cancelado: no se escribio la contrasena.' }

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
    # El nombre lleva la fecha y hora del armado, la misma que muestra la app al pie del menu.
    # Se deja solo el ultimo APK definitivo en cada carpeta (el de prueba, OpenGravity-prueba.apk, no se toca).
    $nombre = 'OpenGravity ' + $ahora.ToString('dd-MM-yyyy HH.mm') + '.apk'
    $viejos = '^OpenGravity( \d\d-\d\d-\d{4} \d\d\.\d\d)?\.apk$'
    New-Item -ItemType Directory -Force $salida | Out-Null
    Get-ChildItem $salida -Filter 'OpenGravity*.apk' | Where-Object { $_.Name -match $viejos } | Remove-Item -Force
    $destino = Join-Path $salida $nombre
    Copy-Item $apk $destino -Force
    Write-Host ''
    Write-Host "APK listo: $destino" -ForegroundColor Green
    Write-Host ("En la app, al pie del menu, va a decir: Version: APK del " + $ahora.ToString('dd/MM/yyyy HH:mm')) -ForegroundColor Green
    if (Test-Path $drive) {
        Get-ChildItem $drive -Filter 'OpenGravity*.apk' | Where-Object { $_.Name -match $viejos } | Remove-Item -Force
        Copy-Item $apk (Join-Path $drive $nombre) -Force
        Write-Host "Copiado a Google Drive: $drive\$nombre (puede tardar un minuto en sincronizar)" -ForegroundColor Green
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
