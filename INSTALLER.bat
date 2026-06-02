@echo off
echo ============================================
echo    LogiWMS - Installation automatique
echo ============================================
echo.

:: Verifier si Node.js est installe
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR: Node.js n'est pas installe !
    echo.
    echo Veuillez installer Node.js depuis :
    echo https://nodejs.org  (choisir la version LTS)
    echo.
    echo Puis relancer ce fichier INSTALLER.bat
    pause
    exit /b 1
)

echo Node.js detecte :
node --version
echo.

echo Installation des dependances en cours...
npm install
if %errorlevel% neq 0 (
    echo ERREUR lors de l'installation !
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Installation terminee avec succes !
echo ============================================
echo.
echo Pour lancer le logiciel, double-cliquez sur :
echo    LANCER.bat
echo.
pause
