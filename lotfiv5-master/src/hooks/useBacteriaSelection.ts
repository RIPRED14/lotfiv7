import { useState, useEffect } from 'react';

// Clé utilisée pour stocker les sélections dans localStorage
const STORAGE_KEY = 'lotfiv2-bacteria-selection';

// Valeurs par défaut si aucune sélection n'existe dans localStorage
const DEFAULT_SELECTION = ['entero', 'levures3j'];

export default function useBacteriaSelection() {
  // Initialiser avec les valeurs du localStorage ou les valeurs par défaut
  const [selectedBacteria, setSelectedBacteria] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_SELECTION;
    } catch (error) {
      console.error('Error loading bacteria selection from localStorage:', error);
      return DEFAULT_SELECTION;
    }
  });

  // Mettre à jour localStorage quand selectedBacteria change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedBacteria));
    } catch (error) {
      console.error('Error saving bacteria selection to localStorage:', error);
    }
  }, [selectedBacteria]);

  // Fonction pour basculer une bactérie (ajouter/retirer)
  const toggleBacteria = (id: string) => {
    setSelectedBacteria(prev => 
      prev.includes(id) 
        ? prev.filter(b => b !== id) 
        : [...prev, id]
    );
  };

  // Fonction pour ajouter une bactérie
  const addBacteria = (id: string) => {
    if (!selectedBacteria.includes(id)) {
      setSelectedBacteria(prev => [...prev, id]);
    }
  };

  // Fonction pour supprimer une bactérie
  const removeBacteria = (id: string) => {
    setSelectedBacteria(prev => prev.filter(b => b !== id));
  };

  // Fonction pour réinitialiser aux valeurs par défaut
  const resetToDefaults = () => {
    setSelectedBacteria(DEFAULT_SELECTION);
  };

  return {
    selectedBacteria,
    toggleBacteria,
    addBacteria,
    removeBacteria,
    resetToDefaults
  };
} 