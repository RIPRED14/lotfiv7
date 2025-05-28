// Script pour examiner la structure de la table samples
import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const SUPABASE_URL = "https://bkdcbrnfzgnafjwnryme.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGNicm5memduYWZqd25yeW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2ODA1MTAsImV4cCI6MjA2MTI1NjUxMH0.cdzP9f_Bg1TlrBs-v1DsOb5Iv-tfK0KURPwZn1hwYMU";

// Créer le client
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Fonction pour tester les insertions avec différentes combinaisons
async function testInsertCombinations() {
  console.log("Test d'insertions avec différentes combinaisons de champs...");
  console.log("-------------------------------------------------------");
  
  // Test de différentes combinaisons de champs
  const testCases = [
    {
      name: "Minimal (id et number seulement)",
      fields: {
        number: `TEST-MIN-${Date.now()}`
      }
    },
    {
      name: "Avec product",
      fields: {
        number: `TEST-PROD-${Date.now()}`,
        product: "Test Product"
      }
    },
    {
      name: "Avec champs d'évaluation",
      fields: {
        number: `TEST-EVAL-${Date.now()}`,
        product: "Test Evaluation",
        smell: "A",
        texture: "A",
        taste: "A",
        aspect: "A"
      }
    },
    {
      name: "Avec données temporelles",
      fields: {
        number: `TEST-TIME-${Date.now()}`,
        product: "Test Time",
        ready_time: "10:00",
        fabrication: "2025-05-20",
        dlc: "2025-06-20"
      }
    },
    {
      name: "Avec tous les champs communs",
      fields: {
        number: `TEST-FULL-${Date.now()}`,
        product: "Test Complet",
        ready_time: "10:00",
        fabrication: "2025-05-20",
        dlc: "2025-06-20",
        smell: "A",
        texture: "A",
        taste: "A",
        aspect: "A",
        ph: "4.5",
        enterobacteria: "<10",
        yeast_mold: "<100",
        status: "pending",
        brand: "Test Brand"
      }
    }
  ];
  
  // Tester chaque combinaison
  for (const testCase of testCases) {
    console.log(`\n📋 TEST: ${testCase.name}`);
    console.log("Champs:", testCase.fields);
    
    try {
      const { data, error } = await supabase
        .from('samples')
        .insert(testCase.fields)
        .select();
      
      if (error) {
        console.error(`❌ ÉCHEC: ${error.message}`);
        console.error(`   Code: ${error.code}, Détails: ${error.details || "N/A"}`);
        
        // Analyse de l'erreur pour détecter les contraintes
        if (error.message.includes("violates not-null constraint")) {
          const match = error.message.match(/column "([^"]+)"/);
          if (match) {
            console.error(`   ⚠️ Champ obligatoire manquant: ${match[1]}`);
          }
        }
      } else {
        console.log("✅ SUCCÈS: Insertion réussie");
        console.log("   ID:", data[0].id);
      }
    } catch (err) {
      console.error("❌ EXCEPTION:", err);
    }
  }
}

// Essayer de récupérer la structure de la table
async function analyzeTableStructure() {
  console.log("\n🔍 ANALYSE DE LA STRUCTURE DE LA TABLE");
  console.log("-------------------------------------------------------");
  
  try {
    // Tentative 1: Utiliser le schéma d'information PostgreSQL
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_sample_columns');
    
    if (columnsError) {
      console.error("❌ Impossible d'obtenir les colonnes via RPC:", columnsError.message);
    } else {
      console.log("✅ Structure de la table obtenue:");
      console.table(columns);
    }
    
    // Tentative 2: Essayer de lire les deux enregistrements existants
    console.log("\nRécupération des échantillons existants...");
    const { data: samples, error: samplesError } = await supabase
      .from('samples')
      .select('*');
    
    if (samplesError) {
      console.error("❌ Erreur lors de la récupération des échantillons:", samplesError.message);
    } else if (samples && samples.length > 0) {
      console.log(`✅ ${samples.length} échantillons trouvés. Structure déduite:`);
      console.log("Colonnes:", Object.keys(samples[0]));
      
      // Analyser les valeurs non nulles pour déduire les colonnes obligatoires
      const nonNullColumns = {};
      
      samples.forEach(sample => {
        Object.entries(sample).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            nonNullColumns[key] = (nonNullColumns[key] || 0) + 1;
          }
        });
      });
      
      console.log("\nColonnes toujours renseignées (possiblement obligatoires):");
      for (const [col, count] of Object.entries(nonNullColumns)) {
        if (count === samples.length) {
          console.log(`- ${col}`);
        }
      }
    } else {
      console.log("⚠️ Aucun échantillon trouvé pour déduire la structure");
    }
  } catch (err) {
    console.error("❌ EXCEPTION:", err);
  }
}

// Exécution principale
async function main() {
  await analyzeTableStructure();
  await testInsertCombinations();
  console.log("\n✅ Tests terminés");
}

main().catch(err => {
  console.error("\n❌ Erreur globale:", err);
}); 