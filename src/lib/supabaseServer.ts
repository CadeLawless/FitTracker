// Supabase client setup - this is our database connection
// Supabase is a modern alternative to traditional databases like MySQL
// It provides real-time features and is much easier to set up

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SERVER_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SERVER_SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const doesUserExist = async (email: string): Promise<boolean|string> => {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Error fetching user:', error);
    throw error;
  }

  const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if(!!found){
    return found.id;
  }else{
    return false;
  }
}