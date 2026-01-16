#!/bin/bash
set -euo pipefail

target_url="http://localhost:9876/"
export TARGET_URL="$target_url"

docker compose up -d

is_wsl() {
  [[ -n "${WSL_DISTRO_NAME:-}" ]] && return 0
  if [[ -f /proc/version ]]; then
    if command -v rg >/dev/null 2>&1; then
      rg -q "Microsoft|WSL" /proc/version && return 0
    else
      grep -qE "Microsoft|WSL" /proc/version && return 0
    fi
  fi
  return 1
}

open_browser_macos() {
  osascript <<'APPLESCRIPT'
set targetURL to "http://localhost:9876/"
tell application "Finder"
    set screenBounds to bounds of window of desktop
end tell
tell application "Brave Browser"
    activate
    set newWindow to make new window with properties {mode:"incognito"}
    set bounds of newWindow to screenBounds
    set zoomed of newWindow to true -- maximiza sin pantalla completa
    set URL of active tab of newWindow to targetURL
end tell
repeat
    delay 1
    tell application "Brave Browser"
        if (count of (tabs of windows whose URL is targetURL)) = 0 then exit repeat
    end tell
end repeat
APPLESCRIPT
}

open_browser_wsl() {
  powershell.exe -NoProfile -Command '& { param($u) $pos=$null; $size=$null; try { Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $pos="--window-position=$($b.X),$($b.Y)"; $size="--window-size=$($b.Width),$($b.Height)" } catch {} try { $profile=Join-Path $env:TEMP ("cameras-viewer-" + [guid]::NewGuid().ToString()); $args=@("--incognito","--disable-background-mode","--user-data-dir=$profile"); if ($pos) { $args += $pos } if ($size) { $args += $size } $args += $u; $p=Start-Process "brave.exe" -ArgumentList $args -PassThru; $p.WaitForExit(); if (Test-Path $profile) { Remove-Item -Recurse -Force $profile } } catch { Start-Process $u; Read-Host "Abre el navegador en Windows y pulsa Enter para detener los contenedores..." } }' "$target_url" >/dev/null 2>&1 || true
}

open_browser_linux() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$target_url" >/dev/null 2>&1 || true
  fi
  printf "Press Enter to stop the containers...\n"
  read -r
}

case "$(uname -s)" in
  Darwin)
    open_browser_macos
    ;;
  Linux)
    if is_wsl; then
      open_browser_wsl
    else
      open_browser_linux
    fi
    ;;
  *)
    printf "Unsupported system: %s\n" "$(uname -s)"
    printf "Press Enter to stop the containers...\n"
    read -r
    ;;
esac

docker compose stop
