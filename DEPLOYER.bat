@echo off
echo ============================================
echo        LogiWMS - Deploiement prod
echo ============================================
echo.

:: Verifier Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR: Node.js n'est pas installe !
    pause
    exit /b 1
)

:: Recuperer la derniere version depuis GitHub
echo [1/3] Recuperation de la derniere version...
git pull origin master
if %errorlevel% neq 0 (
    echo ERREUR lors du git pull.
    echo Verifiez votre connexion internet et reessayez.
    pause
    exit /b 1
)
echo.

:: Installer / mettre a jour les dependances
echo [2/3] Mise a jour des dependances...
npm install
if %errorlevel% neq 0 (
    echo ERREUR lors de l'installation des dependances.
    pause
    exit /b 1
)
echo.

:: Construire pour la production
echo [3/3] Construction du build de production...
npm run build
if %errorlevel% neq 0 (
    echo ERREUR lors du build.
    pause
    exit /b 1
)
echo.

echo ============================================
echo   Deploiement termine avec succes !
echo ============================================
echo.
echo Lancez maintenant LANCER.bat pour demarrer
echo le serveur de production.
echo.
pause
