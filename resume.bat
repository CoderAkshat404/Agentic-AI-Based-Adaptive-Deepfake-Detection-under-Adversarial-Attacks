@echo off
REM Run or RESUME the full pipeline (safe after a shutdown: finished work is kept).
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python scripts\run_pipeline.py
pause
