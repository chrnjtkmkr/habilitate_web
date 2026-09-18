@echo off
title Auto-Commit Watcher
echo Starting auto-commit watcher...
powershell.exe -NoExit -ExecutionPolicy Bypass -File "%~dp0auto-commit.ps1"

