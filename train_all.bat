@echo off
REM Same as resume.bat: runs every stage, skipping what is already finished.
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python scripts\run_pipeline.py
pause
