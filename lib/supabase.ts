import { createClient } from '@supabase/supabase-js';

/* ─── Primary Supabase project ─── */
const SUPABASE_URL = 'https://apzpxnkmuhcwmvmgisms.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwenB4bmttdWhjd212bWdpc21zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzg2MjksImV4cCI6MjA4OTk1NDYyOX0.Hr0n3c4l0vznMRN7eLPB40VATb77CjyOBWmYlLlK3KM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
