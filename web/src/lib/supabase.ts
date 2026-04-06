import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://apzpxnkmuhcwmvmgisms.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwenB4bmttdWhjd212bWdpc21zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzg2MjksImV4cCI6MjA4OTk1NDYyOX0.Hr0n3c4l0vznMRN7eLPB40VATb77CjyOBWmYlLlK3KM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin user ID — only this user can access /admin
export const ADMIN_USER_ID = '536cdc76-abab-4471-a276-728c5aaf2132';
