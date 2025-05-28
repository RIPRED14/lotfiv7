@echo off
echo ===== MISE A JOUR COMPLETE VERS GITHUB =====
echo.

echo Configuration Git...
git config --global user.email "votre-email@example.com"
git config --global user.name "RIPRED14"

echo.
echo Verification du statut Git...
git status

echo.
echo Ajout de tous les fichiers...
git add .

echo.
echo Creation du commit...
git commit -m "Lotfi v7 - Application microbiologique complete avec toutes les fonctionnalites"

echo.
echo Verification du remote...
git remote -v

echo.
echo Configuration du remote GitHub...
git remote remove origin 2>nul
git remote add origin https://github.com/RIPRED14/lotfiv7.git

echo.
echo Push vers GitHub...
git push -u origin main --force

echo.
echo ===== MISE A JOUR TERMINEE =====
echo Le projet complet est maintenant sur GitHub !
echo Repository: https://github.com/RIPRED14/lotfiv7.git
echo.
pause
