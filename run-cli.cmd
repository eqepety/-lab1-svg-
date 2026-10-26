@echo off
setlocal
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required.
  popd
  exit /b 1
)
if not exist "node_modules\.bin\tsc.cmd" (
  echo Dependencies are missing. Run npm ci in this project folder first.
  popd
  exit /b 1
)
call "node_modules\.bin\tsc.cmd" -p tsconfig.json
if errorlevel 1 (
  popd
  exit /b 1
)
node dist\src\main.js
set "SVG_EDITOR_EXIT=%ERRORLEVEL%"
popd
exit /b %SVG_EDITOR_EXIT%
