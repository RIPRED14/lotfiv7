#!/usr/bin/env pwsh
# Script pour mettre à jour automatiquement le dépôt GitHub lotfiv7
# Sauvegardez ce fichier dans le dossier racine du projet

Write-Host "===== Mise à jour automatique vers GitHub lotfiv7 =====" -ForegroundColor Green

# Configuration Git
Write-Host "Configuration Git..." -ForegroundColor Cyan
git config --global user.email "votre-email@example.com"
git config --global user.name "RIPRED14"

# Vérifier les modifications
Write-Host "Vérification des modifications..." -ForegroundColor Cyan
git status

# Ajouter toutes les modifications
Write-Host "Ajout des modifications..." -ForegroundColor Cyan
git add .

# Message de commit automatique
$commitMessage = "Lotfi v7 - Application microbiologique avec calendrier ameliore et lectures en attente - $(Get-Date -Format 'dd-MM-yyyy HH:mm')"

# Créer un commit avec le message fourni
Write-Host "Création du commit..." -ForegroundColor Cyan
git commit -m "$commitMessage"

# Supprimer l'ancien remote s'il existe et ajouter le nouveau
Write-Host "Configuration du remote GitHub..." -ForegroundColor Cyan
git remote remove origin 2>$null
git remote add origin https://github.com/RIPRED14/lotfiv7.git

# Pousser les modifications vers GitHub
Write-Host "Envoi des modifications vers GitHub..." -ForegroundColor Cyan
git push -u origin main

Write-Host "===== Mise à jour terminée avec succès! =====" -ForegroundColor Green

# Attendre que l'utilisateur appuie sur une touche avant de fermer
Write-Host "Appuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")