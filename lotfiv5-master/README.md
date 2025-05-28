# Système de Contrôle Microbiologique

## Description

Application web moderne pour la gestion complète des analyses microbiologiques en laboratoire. Ce système permet de suivre l'ensemble du processus d'analyse, de la création de formulaires jusqu'à la saisie des résultats finaux.

## Fonctionnalités Principales

### 🔬 Gestion des Analyses
- Création et suivi de formulaires d'analyse
- Workflow complet avec gestion des statuts
- Analyses de base (odeur, texture, goût, aspect, pH)
- Analyses microbiologiques spécialisées

### 📊 Suivi et Planification
- Calendrier des lectures microbiologiques
- Planification automatique des délais par type de bactérie
- Tableau de bord pour le suivi des analyses en cours
- Filtrage et recherche avancés

### 👥 Gestion des Rôles
- **Coordinateur** : Création de formulaires, gestion complète
- **Technicien** : Saisie des analyses et résultats

### 🦠 Types de Micro-organismes
- Entérobactéries (délai : 1 jour)
- Levures/Moisissures (délai : 5 jours)
- Listeria (délai : 2 jours)
- Coliformes totaux (délai : 1 jour)
- Staphylocoques (délai : 2 jours)

## Technologies Utilisées

- **Frontend** : React 18 + TypeScript + Vite
- **UI** : Tailwind CSS + Radix UI + Lucide Icons
- **Backend** : Supabase (PostgreSQL + Auth + Real-time)
- **Routing** : React Router v6
- **State Management** : React Hooks + Context API

## Installation

### Prérequis
- Node.js 18+ 
- npm ou yarn
- Compte Supabase

### Configuration

1. **Cloner le projet**
```bash
git clone <repository-url>
cd lotfiv5-master
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration Supabase**
Créer un fichier `.env.local` :
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Appliquer les migrations**
Exécuter les scripts SQL dans `/src/migrations/` :
- `add_microbiological_workflow_fields.sql`
- `add_microbiological_results_fields.sql`

5. **Lancer l'application**
```bash
npm run dev
```

## Structure du Projet

```
src/
├── components/          # Composants réutilisables
│   ├── ui/             # Composants UI de base
│   └── FormStatusCard/ # Gestion des statuts
├── contexts/           # Contextes React
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── lib/               # Utilitaires et configuration
│   └── supabase.ts
├── migrations/        # Scripts SQL
├── pages/            # Pages de l'application
│   ├── QualityControlPage.tsx
│   ├── SampleEntryPage.tsx
│   ├── AnalysisInProgressPage.tsx
│   ├── SampleManagementPage.tsx
│   ├── ReadingCalendarPage.tsx
│   └── ReadingResultsPage.tsx
└── App.tsx           # Configuration des routes
```

## Pages Principales

### `/quality-control`
Point d'entrée principal avec sélection du site et accès rapide aux fonctionnalités.

### `/sample-entry`
Saisie des échantillons avec analyses de base et planification des lectures.

### `/analyses-en-cours`
Vue des formulaires en cours pour les techniciens.

### `/gestion-echantillons`
Suivi détaillé avec filtres et barres de progression.

### `/lecture-calendar`
Calendrier des lectures organisé par type de bactérie.

### `/saisie-resultats`
Interface de saisie des résultats microbiologiques.

## Workflow

```
1. Coordinateur → Crée formulaire (draft)
2. Coordinateur → Lance analyses (in_progress)
3. Technicien → Analyses de base + sélection bactéries
4. Système → Statut (waiting_reading)
5. Technicien → Lectures microbiologiques
6. Système → Statut (completed)
```

## Base de Données

### Table `samples`
Champs principaux pour le workflow microbiologique :

- **Workflow** : `status`, `reading_day`, `analysis_type`, `reading_date`
- **Résultats** : `enterobacteria_count`, `yeast_mold_count`, `listeria_count`, `coliforms_count`, `staphylococcus_count`
- **Métadonnées** : `reading_comments`, `reading_technician`

## Scripts Disponibles

```bash
npm run dev          # Développement
npm run build        # Build de production
npm run preview      # Aperçu du build
npm run lint         # Vérification du code
```

## Déploiement

1. **Build de production**
```bash
npm run build
```

2. **Déployer le dossier `dist/`** sur votre hébergeur

3. **Configuration des variables d'environnement** sur la plateforme de déploiement

## Documentation Technique

Voir [MICROBIOLOGICAL_WORKFLOW.md](./MICROBIOLOGICAL_WORKFLOW.md) pour la documentation technique détaillée.

## Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrir une Pull Request

## Support

Pour toute question ou problème :
- Consulter la documentation technique
- Vérifier les issues existantes
- Créer une nouvelle issue si nécessaire

## Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

**Version** : 1.0.0  
**Dernière mise à jour** : Mai 2025
