@echo off
echo ========================================
echo FIXING FRONTEND - Deleting Old Files
echo ========================================

cd "C:\Users\Aayush Tiwari\Desktop\The Music Project\frontend"

echo.
echo [1/5] Stopping all Node processes...
taskkill /F /IM node.exe 2>nul

echo.
echo [2/5] Deleting old .jsx files...
if exist "src\App.jsx" (
    del "src\App.jsx"
    echo     - Deleted App.jsx
) else (
    echo     - App.jsx already deleted
)

if exist "src\main.jsx" (
    del "src\main.jsx"  
    echo     - Deleted main.jsx
) else (
    echo     - main.jsx doesn't exist
)

echo.
echo [3/5] Clearing Vite cache...
if exist "node_modules\.vite" (
    rmdir /s /q "node_modules\.vite"
    echo     - Cleared Vite cache
) else (
    echo     - No Vite cache to clear
)

if exist ".vite" (
    rmdir /s /q ".vite"
    echo     - Cleared .vite directory
)

echo.
echo [4/5] Clearing browser cache instructions...
echo     - After servers start, press Ctrl+Shift+R in browser
echo     - Or Ctrl+F5 to hard refresh

echo.
echo [5/5] Starting frontend server...
echo.
echo ========================================
echo Starting Vite Dev Server...
echo ========================================
npm run dev

pause
