import { supabase } from './lib/supabaseClient';

(async () => {
  const { data, error } = await supabase.from('todos').select('*').limit(1);
  if (error) {
    console.error('Supabase connection failed:', error);
    process.exit(1);
  } else {
    console.log('Supabase connection successful:', data);
    process.exit(0);
  }
})(); 