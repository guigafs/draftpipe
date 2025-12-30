import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nahdvprippejblpnpjla.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_i1zvuavkOx7W7bC-hcPgzw_Uhxm2W3M';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
