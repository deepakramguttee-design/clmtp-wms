@echo off
echo ============================================
echo         LogiWMS - Demarrage
echo ============================================
echo.

:: Verifier que le build de production existe
if not exist "dist\index.html" (
    echo ATTENTION : Aucun build de production trouve.
    echo Lancez d'abord DEPLOYER.bat pour construire l'application.
    echo.
    pause
    exit /b 1
)

echo Le logiciel va s'ouvrir dans votre navigateur...
echo Ne fermez pas cette fenetre !
echo.
echo Pour arreter le logiciel : appuyez sur Ctrl+C
echo.
start http://localhost:5173
npm run serve
