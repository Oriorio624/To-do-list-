import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aabvkcpdbyjuhppcjoeg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhYnZrY3BkYnlqdWhwcGNqb2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MjYwODQsImV4cCI6MjA2NTEwMjA4NH0.g9my0aCxSPa0jW-Bi0IrLVwSca5sM9nORuSgj1t0wcA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 