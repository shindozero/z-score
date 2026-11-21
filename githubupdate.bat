@echo off
cd /d %~dp0
git add .
git commit -m "データを更新"
git push
pause