// Script pour tester l'authentification Supabase
import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const SUPABASE_URL = "https://bkdcbrnfzgnafjwnryme.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGNicm5memduYWZqd25yeW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2ODA1MTAsImV4cCI6MjA2MTI1NjUxMH0.cdzP9f_Bg1TlrBs-v1DsOb5Iv-tfK0KURPwZn1hwYMU";

// Créer le client
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Identifiants de test (extraits du code de l'application)
const testCredentials = [
  { email: 'demo.coordinator@collet.fr', password: 'demo123', role: 'coordinator' },
  { email: 'demo.technician@collet.fr', password: 'demo123', role: 'technician' },
];

// Fonction pour tester la connexion avec différents utilisateurs
async function testAuthentication() {
  console.log("Test d'authentification Supabase...");
  
  for (const credentials of testCredentials) {
    try {
      console.log(`\nTentative de connexion avec: ${credentials.email} (${credentials.role})...`);
      
      // Essai de connexion par email/mot de passe
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });
      
      if (error) {
        console.error(`❌ Échec de connexion pour ${credentials.email}:`, error);
        continue;
      }
      
      console.log(`✅ Connexion réussie pour ${credentials.email} !`);
      console.log(`   Token: ${data.session?.access_token.substring(0, 20)}...`);
      
      // Tester l'accès aux données
      const { data: samples, error: samplesError } = await supabase
        .from('samples')
        .select('count');
      
      if (samplesError) {
        console.error(`❌ Erreur d'accès aux échantillons:`, samplesError);
      } else {
        console.log(`✅ Accès aux échantillons réussi:`, samples);
      }
      
      // Tester la récupération du profil utilisateur
      const { data: profileData, error: profileError } = await supabase.auth.getUser();
      
      if (profileError) {
        console.error(`❌ Erreur de récupération du profil:`, profileError);
      } else {
        console.log(`✅ Profil utilisateur:`, profileData.user);
      }
      
      // Déconnexion
      await supabase.auth.signOut();
      console.log(`ℹ️ Déconnexion effectuée`);
      
    } catch (err) {
      console.error(`❌ Exception pour ${credentials.email}:`, err);
    }
  }
}

// Récupérer les politiques de sécurité (RLS) si possible
async function getPolicies() {
  console.log("\nTentative de récupération des politiques de sécurité...");
  
  try {
    // Essayer d'exécuter une requête qui pourrait montrer les politiques
    // Note: Cela ne fonctionnera probablement pas sans droits d'administrateur
    const { data, error } = await supabase.rpc('get_policies');
    
    if (error) {
      console.error("❌ Erreur lors de la récupération des politiques:", error);
      
      // Plan B: Essayer de créer un nouvel utilisateur de test
      console.log("\nTentative de création d'un nouvel utilisateur...");
      
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: `test.user.${Date.now()}@example.com`,
        password: 'Password123!',
      });
      
      if (signupError) {
        console.error("❌ Erreur lors de la création d'utilisateur:", signupError);
      } else {
        console.log("✅ Utilisateur créé ou invitation envoyée:", signupData);
      }
    } else {
      console.log("✅ Politiques récupérées:", data);
    }
  } catch (err) {
    console.error("❌ Exception:", err);
  }
}

// Exécution
async function main() {
  await testAuthentication();
  await getPolicies();
  console.log("\n✅ Tests terminés");
}

main().catch(err => {
  console.error("❌ Erreur globale:", err);
}); 