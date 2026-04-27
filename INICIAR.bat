@echo off
title KiAgenda Multi Bot

echo =========================
echo Iniciando KiAgenda...
echo =========================

cd /d "%~dp0"

echo Pasta atual:
cd

echo.
echo Rodando npm install...
call npm install

echo.
echo Iniciando servidor...
call npm start

pause