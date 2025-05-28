import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bkdcbrnfzgnafjwnryme.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZGNicm5memduYWZqd25yeW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2ODA1MTAsImV4cCI6MjA2MTI1NjUxMH0.cdzP9f_Bg1TlrBs-v1DsOb5Iv-tfK0KURPwZn1hwYMU'
);

console.log('🔍 Test de connexion Supabase avec la nouvelle clé...');

try {
  const { data, error } = await supabase.from('samples').select('count').limit(1);
  if (error) {
    console.log('❌ Erreur:', error.message);
  } else {
    console.log('✅ Connexion réussie!');
    console.log('📊 Données:', data);
  }
} catch (err) {
  console.log('❌ Exception:', err.message);
}
