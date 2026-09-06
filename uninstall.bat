@echo off
rem RPG ツクール MV / MZ のゲームからチート UI を削除する。
rem ゲームフォルダをドラッグ＆ドロップするか、ダブルクリックする。
rem 控えのファイル（.cheatui-backup-*）はそのまま残す。
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\install.ps1" -GamePath "%~1" -Uninstall
echo.
pause
