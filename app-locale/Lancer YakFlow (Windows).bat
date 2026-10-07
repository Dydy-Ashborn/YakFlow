@echo off
chcp 65001 >nul
REM YakFlow - lanceur Windows (double-clic)
cd /d "%~dp0"
set PY=
where py >nul 2>nul && set PY=py -3
if not defined PY (where python >nul 2>nul && set PY=python)
if not defined PY (
  echo.
  echo   Python 3 est necessaire pour faire tourner YakFlow.
  echo   Installe-le depuis https://www.python.org/downloads/ en cochant "Add python.exe to PATH", puis relance YakFlow.
  echo.
  start https://www.python.org/downloads/
  pause
  exit /b 1
)
echo.
echo   YakFlow demarre. Laisse cette fenetre ouverte pendant que tu travailles.
echo.
%PY% serveur.py
pause
