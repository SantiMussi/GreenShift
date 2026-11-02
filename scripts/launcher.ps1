# Ayudante de iniciar.bat: chequeos, arranque, barra de progreso y apagado de GreenShift.
# Se usa desde iniciar.bat (no hace falta correrlo a mano).
param(
  [Parameter(Mandatory = $true)][string]$Modo,
  [string]$Opcion = ''
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$raiz = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $raiz 'logs'
$archivoPid = Join-Path $logs 'servidor.pid'
$salida = Join-Path $logs 'servidor.log'
$errores = Join-Path $logs 'servidor-err.log'
$urlWeb = 'http://localhost:3000'
$urlApi = 'http://127.0.0.1:8000'

# --- Colores (ANSI truecolor) ---
$e = [char]27
function Col([int]$r, [int]$g, [int]$b) { "$e[38;2;${r};${g};${b}m" }
$rst = "$e[0m"
$neg = "$e[1m"
$lima = Col 197 240 74
$agua = Col 79 224 194
$ambar = Col 245 193 78
$rojo = Col 255 90 96
$gris = Col 133 139 148
$blanco = Col 247 244 237

# Activa el procesamiento de ANSI en la consola (hace falta en conhost; Windows Terminal ya lo trae).
function Activar-Colores {
  try {
    Add-Type -Namespace GS -Name K -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern System.IntPtr GetStdHandle(int n);
[DllImport("kernel32.dll")] public static extern bool GetConsoleMode(System.IntPtr h, out int m);
[DllImport("kernel32.dll")] public static extern bool SetConsoleMode(System.IntPtr h, int m);
'@
    $h = [GS.K]::GetStdHandle(-11)
    $m = 0
    if ([GS.K]::GetConsoleMode($h, [ref]$m)) { [void][GS.K]::SetConsoleMode($h, ($m -bor 4)) }
  } catch { }
}

# Un clic dentro de la ventana activa el "modo selección" de la consola, que pausa el programa hasta
# apretar Esc o clic derecho (la animación parece congelada). Se apaga mientras corre el launcher.
function Selección([bool]$permitir) {
  try {
    Activar-Colores
    $hi = [GS.K]::GetStdHandle(-10)
    $mi = 0
    if ([GS.K]::GetConsoleMode($hi, [ref]$mi)) {
      if ($permitir) { $nuevo = $mi -bor 0x80 -bor 0x40 } else { $nuevo = ($mi -bor 0x80) -band (-bnot 0x40) }
      [void][GS.K]::SetConsoleMode($hi, $nuevo)
    }
  } catch { }
}

function Linea([bool]$ok, [string]$texto, [string]$detalle) {
  if ($ok) { $marca = "${lima}✔${rst}" } else { $marca = "${rojo}✖${rst}" }
  Write-Host ("   {0} {1}{2}{3}  {4}{5}{6}" -f $marca, $blanco, $texto, $rst, $gris, $detalle, $rst)
}

function Leer-Compartido([string]$ruta) {
  if (-not (Test-Path $ruta)) { return '' }
  try {
    $fs = [System.IO.File]::Open($ruta, 'Open', 'Read', 'ReadWrite')
    $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
    $txt = $sr.ReadToEnd()
    $sr.Close()
    return $txt
  } catch { return '' }
}

function Dueno-Puerto([int]$puerto) {
  try {
    $c = Get-NetTCPConnection -State Listen -LocalPort $puerto -ErrorAction Stop | Select-Object -First 1
    if ($c) { return [int]$c.OwningProcess }
  } catch { }
  try {
    $m = netstat -ano -p tcp | Select-String -Pattern (":$puerto\s+\S+\s+(LISTENING|ESCUCHANDO)\s+(\d+)") | Select-Object -First 1
    if ($m) { return [int]$m.Matches[0].Groups[2].Value }
  } catch { }
  return 0
}

function Buscar-Python {
  foreach ($c in @('python', 'py -3', 'python3')) {
    try {
      $o = (cmd /c "$c --version 2>&1" | Out-String)
      if ($o -match 'Python (\d+)\.(\d+)\.(\d+)') {
        $mayor = [int]$Matches[1]
        $menor = [int]$Matches[2]
        return @{ Version = $Matches[0]; Ok = (($mayor -gt 3) -or ($mayor -eq 3 -and $menor -ge 10)) }
      }
    } catch { }
  }
  return $null
}

function Preguntar([string]$texto) {
  Write-Host -NoNewline ("   {0}{1}{2} {3}[S/N]{4} " -f $ambar, $texto, $rst, $gris, $rst)
  $r = ''
  try { $r = [string][Console]::ReadKey($true).KeyChar } catch { $r = (Read-Host) }
  Write-Host $r
  return ($r -match '^[sSyY]')
}

switch ($Modo) {

  'vt' { Activar-Colores; Selección $false }

  'restaurar' { Selección $true }

  'chequeos' {
    Activar-Colores
    $fatal = $false

    # Node.js
    $n = ''
    try { $n = (cmd /c "node -v 2>&1" | Out-String).Trim() } catch { }
    if ($n -match '^v(\d+)\.') {
      $ok = ([int]$Matches[1] -ge 20)
      Linea $ok 'Node.js' ("$n" + $(if ($ok) { '' } else { '  (hace falta 20 o más: https://nodejs.org)' }))
      if (-not $ok) { $fatal = $true }
    } else {
      Linea $false 'Node.js' 'no se encontró: instalalo desde https://nodejs.org'
      $fatal = $true
    }

    # Python
    $py = Buscar-Python
    if ($py -and $py.Ok) {
      Linea $true 'Python' ($py.Version -replace 'Python ', '')
    } elseif ($py) {
      Linea $false 'Python' ("$($py.Version)  (hace falta 3.10 o más: https://python.org)")
      $fatal = $true
    } else {
      Linea $false 'Python' 'no se encontró: instalalo desde https://python.org'
      $fatal = $true
    }
    if ($fatal) { exit 1 }

    # Puertos
    foreach ($par in @(@(3000, 'Interfaz'), @(8000, 'API'))) {
      $puerto = $par[0]
      $dueno = Dueno-Puerto $puerto
      if ($dueno -eq 0) {
        Linea $true ("Puerto $puerto") ("libre para la " + $par[1].ToLower())
        continue
      }
      $nombre = ''
      try { $nombre = (Get-Process -Id $dueno -ErrorAction Stop).ProcessName } catch { }
      Linea $false ("Puerto $puerto") ("ocupado por $nombre (PID $dueno), puede ser una demo que quedó abierta")
      if (Preguntar "¿Cerrarlo para poder iniciar?") {
        taskkill /PID $dueno /T /F | Out-Null
        Start-Sleep -Milliseconds 800
        if ((Dueno-Puerto $puerto) -eq 0) { Linea $true ("Puerto $puerto") 'liberado' } else { Linea $false ("Puerto $puerto") 'sigue ocupado'; exit 1 }
      } else {
        Write-Host ("   {0}Cerralo y volvé a abrir este archivo.{1}" -f $gris, $rst)
        exit 1
      }
    }

    # Primera vez
    $primera = (-not (Test-Path (Join-Path $raiz 'backend\.venv'))) -or (-not (Test-Path (Join-Path $raiz 'frontend\node_modules')))
    if ($primera) {
      Linea $true 'Instalación' 'primera vez: se instalan las dependencias (necesita internet, tarda unos minutos)'
    } else {
      Linea $true 'Instalación' 'dependencias listas, arranca sin internet'
    }
    exit 0
  }

  'iniciar' {
    New-Item -ItemType Directory -Force $logs | Out-Null
    Remove-Item $salida, $errores, $archivoPid -ErrorAction SilentlyContinue
    $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run demo' -WorkingDirectory $raiz -NoNewWindow -PassThru -RedirectStandardOutput $salida -RedirectStandardError $errores
    $p.Id | Set-Content $archivoPid
  }

  'esperar' {
    Activar-Colores
    $inicio = Get-Date
    $cuadros = @('⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏')
    $i = 0
    $web = $false
    $api = $false
    $ultimoChequeo = [DateTime]::MinValue
    $idServidor = 0
    if (Test-Path $archivoPid) { $idServidor = [int](Get-Content $archivoPid) }

    while ($true) {
      $t = (Get-Date) - $inicio
      $log = (Leer-Compartido $salida) + (Leer-Compartido $errores)

      if ((Get-Date) - $ultimoChequeo -gt [TimeSpan]::FromSeconds(1)) {
        $ultimoChequeo = Get-Date
        try { Invoke-WebRequest "$urlApi/api/health" -UseBasicParsing -TimeoutSec 1 | Out-Null; $api = $true } catch { $api = $false }
        try { Invoke-WebRequest $urlWeb -UseBasicParsing -TimeoutSec 1 | Out-Null; $web = $true } catch { $web = $false }
      }

      if ($api -and $web) {
        [Console]::Write("`r$e[2K")
        Write-Host ("   {0}✔{1} {2}Todo listo{1}  {3}en {4:mm\:ss}{1}" -f $lima, $rst, $blanco, $gris, $t)
        exit 0
      }

      if ($idServidor -gt 0 -and -not (Get-Process -Id $idServidor -ErrorAction SilentlyContinue)) {
        [Console]::Write("`r$e[2K")
        Write-Host ("   {0}✖{1} {2}El servidor se detuvo antes de estar listo.{1}" -f $rojo, $rst, $blanco)
        exit 2
      }
      if ($t.TotalMinutes -gt 12) {
        [Console]::Write("`r$e[2K")
        Write-Host ("   {0}✖{1} {2}Pasaron 12 minutos sin que arranque.{1}" -f $rojo, $rst, $blanco)
        exit 1
      }

      if ($log -match 'Ready in') { $etapa = 'Interfaz lista, el planificador calcula el plan inicial' }
      elseif ($log -match 'Compilando el frontend') { $etapa = 'Compilando la interfaz' }
      elseif ($log -match 'Instalando dependencias') { $etapa = 'Instalando dependencias del frontend (solo la primera vez)' }
      elseif ($log -match 'Creando entorno') { $etapa = 'Creando el entorno de Python (solo la primera vez)' }
      else { $etapa = 'Preparando el entorno' }

      $barra = ''
      $pos = [int](($t.TotalSeconds * 7) % 30)
      for ($k = 0; $k -lt 22; $k++) {
        if ((($k - $pos + 30) % 30) -lt 6) { $barra += "${lima}▰" } else { $barra += "${gris}▱" }
      }
      $cuadro = $cuadros[$i % $cuadros.Count]
      $i++
      [Console]::Write(("`r$e[2K   {0}{1}{2} {3}{4,-62}{2}{5}{2}  {6}{7:mm\:ss}{2}" -f $agua, $cuadro, $rst, $blanco, $etapa, $barra, $gris, $t))
      Start-Sleep -Milliseconds 110
    }
  }

  'abrir' {
    $destino = $urlWeb
    if ($Opcion -eq 'claro') { $destino = "$urlWeb/?theme=light" }
    Start-Process $destino
  }

  'log' {
    Activar-Colores
    Write-Host ''
    Write-Host ("   {0}Últimas líneas del registro{1} {2}({3}){1}" -f $neg, $rst, $gris, $salida)
    Write-Host ''
    $todo = (Leer-Compartido $salida) + "`n" + (Leer-Compartido $errores)
    $lineas = $todo -split "`r?`n" | Where-Object { $_.Trim() -ne '' } | Select-Object -Last 22
    foreach ($l in $lineas) { Write-Host ("   {0}{1}{2}" -f $gris, ($l -replace "$e\[[0-9;]*m", ''), $rst) }
    Write-Host ''
  }

  'detener' {
    if (Test-Path $archivoPid) {
      $id = [int](Get-Content $archivoPid)
      taskkill /PID $id /T /F 2>$null | Out-Null
      Remove-Item $archivoPid -ErrorAction SilentlyContinue
    }
    # Por si algo quedó escuchando en los puertos de la demo.
    foreach ($puerto in 3000, 8000) {
      $d = Dueno-Puerto $puerto
      if ($d -gt 0) { taskkill /PID $d /T /F 2>$null | Out-Null }
    }
  }

  default { Write-Host "Modo desconocido: $Modo"; exit 64 }
}
