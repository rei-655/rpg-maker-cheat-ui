@echo off
rem RPG ツクール MV / MZ のゲームにチート UI を導入する。
rem
rem   - ゲームフォルダ（または Game.exe）をこのファイルにドラッグ＆ドロップ
rem   - もしくはダブルクリック。このフォルダがゲーム内にあればそのまま導入し、
rem     見つからなければ選択ダイアログを開く。
rem
rem Windows 標準の PowerShell だけで動く。Node.js は不要。
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\install.ps1" -GamePath "%~1"
echo.
pause
