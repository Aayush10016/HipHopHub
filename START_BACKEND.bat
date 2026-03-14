@echo off
echo ========================================
echo STARTING BACKEND SERVER
echo ========================================

cd "C:\Users\Aayush Tiwari\Desktop\The Music Project\backend"

echo.
echo Starting Spring Boot backend...
echo This will populate test data with 5 artists and 15 songs
echo.
echo WAIT FOR THIS MESSAGE:
echo "✅ TEST DATA POPULATED SUCCESSFULLY!"
echo.
echo ========================================

mvn spring-boot:run
