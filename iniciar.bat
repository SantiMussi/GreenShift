@echo off
rem GreenShift: inicia la demo con doble clic en Windows.
rem Levanta el backend y el frontend, espera a que esten listos y abre el navegador.
rem La primera vez instala dependencias y compila (necesita internet y tarda unos minutos).
rem Con GREENSHIFT_NO_BROWSER=1 no abre el navegador solo.
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title GreenShift
mode con: cols=100 lines=44 >nul 2>nul

rem Activa los colores de la consola y arma la tecla ESC.
call :ps vt
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"

set "R=%ESC%[0m"
set "B=%ESC%[1m"
set "L1=%ESC%[38;2;197;240;74m"
set "L2=%ESC%[38;2;168;237;100m"
set "L3=%ESC%[38;2;138;233;130m"
set "L4=%ESC%[38;2;112;230;158m"
set "L5=%ESC%[38;2;93;227;178m"
set "L6=%ESC%[38;2;79;224;194m"
set "W=%ESC%[38;2;247;244;237m"
set "G=%ESC%[38;2;133;139;148m"
set "A=%ESC%[38;2;245;193;78m"
set "K=%ESC%[38;2;11;13;16m%ESC%[48;2;197;240;74m"

cls
echo.
echo.
echo %L1% ██████╗ ██████╗ ███████╗███████╗███╗   ██╗███████╗██╗  ██╗██╗███████╗████████╗%R%
echo %L2%██╔════╝ ██╔══██╗██╔════╝██╔════╝████╗  ██║██╔════╝██║  ██║██║██╔════╝╚══██╔══╝%R%
echo %L3%██║  ███╗██████╔╝█████╗  █████╗  ██╔██╗ ██║███████╗███████║██║█████╗     ██║   %R%
echo %L4%██║   ██║██╔══██╗██╔══╝  ██╔══╝  ██║╚██╗██║╚════██║██╔══██║██║██╔══╝     ██║   %R%
echo %L5%╚██████╔╝██║  ██║███████╗███████╗██║ ╚████║███████║██║  ██║██║██║        ██║   %R%
echo %L6% ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝╚═╝╚═╝        ╚═╝   %R%
echo.
echo   %B%%W%Planificador de cómputo consciente del carbono%R%   %G%Nubeo  ·  UADE  ·  Seminario TyMA%R%
echo   %A%▪ DATOS SIMULADOS%R%   %G%OR-Tools CP-SAT  ·  FastAPI  ·  Next.js  ·  React Three Fiber%R%
echo.
echo   %G%────────────────────────────────────────────────────────────────────────────────────%R%
echo.
echo   %L1%▸%R% %B%Verificando el equipo%R%
echo.
call :ps chequeos
if errorlevel 1 (
  echo.
  echo   %A%No se pudo continuar. Resolvé lo de arriba y volvé a abrir este archivo.%R%
  echo.
  pause
  exit /b 1
)

echo.
echo   %L1%▸%R% %B%Levantando el sistema%R%
echo.
call :ps iniciar
call :ps esperar
if errorlevel 1 (
  echo.
  call :ps log
  call :ps detener
  echo   %A%Algo salió mal al arrancar. Revisá las últimas líneas de arriba, o el archivo logs\servidor.log.%R%
  echo.
  pause
  exit /b 1
)

if not defined GREENSHIFT_NO_BROWSER call :ps abrir

echo.
echo   %L1%╭────────────────────────────────────────────────────────────────────────────────╮%R%
echo   %L1%│%R%  %B%%W%GreenShift está corriendo%R%                                                     %L1%│%R%
echo   %L1%│%R%                                                                                %L1%│%R%
echo   %L1%│%R%  %G%Interfaz%R%   %L1%http://localhost:3000%R%                                              %L1%│%R%
echo   %L1%│%R%  %G%API%R%        %L1%http://127.0.0.1:8000/docs%R%                                         %L1%│%R%
echo   %L1%╰────────────────────────────────────────────────────────────────────────────────╯%R%
echo.
echo   %L1%▸%R% %B%Atajos dentro de la app%R%
echo.
echo     %K% F %R% %W%pantalla completa%R%        %K% T %R% %W%modo claro / oscuro%R%      %K% H %R% %W%ayuda con todas las teclas%R%
echo     %K% M %R% %W%cambiar de vista%R%         %K% D %R% %W%mapa sin GreenShift%R%      %K% O %R% %W%objetivo del planificador%R%
echo     %K% 1 %R%%K% 2 %R%%K% 3 %R%%K% 4 %R% %W%escenarios%R%       %K% 0 %R% %W%día normal%R%              %K% C %R% %W%pantalla de cierre%R%
echo     %K% P %R% %W%guion automático de 3 min%R%  %K% R %R% %W%reiniciar el día%R%       %K% Espacio %R% %W%pausa%R%
echo.
echo   %G%────────────────────────────────────────────────────────────────────────────────────%R%

:menu
echo.
echo   %K% N %R% %W%abrir el navegador%R%   %K% C %R% %W%abrir en modo claro%R%   %K% L %R% %W%ver el registro%R%   %K% Q %R% %W%apagar y salir%R%
choice /c NCLQ /n /m "  > "
if errorlevel 4 goto salir
if errorlevel 3 (
  call :ps log
  goto menu
)
if errorlevel 2 (
  call :ps abrir claro
  goto menu
)
call :ps abrir
goto menu

:salir
echo.
echo   %G%Apagando GreenShift...%R%
call :ps detener
echo   %L1%✔%R% %W%Listo. ¡Mucha suerte en la exposición!%R%
echo.
ping -n 4 127.0.0.1 >nul
exit /b 0

:ps
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launcher.ps1" %1 %2
exit /b %errorlevel%
