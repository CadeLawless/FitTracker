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

interface resetPasswordResult {
  success: boolean;
  message: string;
};

export const resetPassword = async (token: string, newPassword: string): Promise<resetPasswordResult> => {
  const { data: tokenData, error } = await supabase
    .from('password_resets')
    .select('user_id, expires_at, used')
    .eq('token', token)
    .maybeSingle();

  if (error || !tokenData || tokenData.used || new Date(tokenData.expires_at) < new Date()) {
    return {
      success: false,
      message: 'Invalid or expired password reset token',
    };
  }

  // 2. Update user password in Supabase Auth using Admin API
  const { data: user, error: updateError } = await supabase.auth.admin.updateUserById(tokenData.user_id, {
    password: newPassword,
  });

  if (updateError) {
    throw updateError;
  }

  // 3. Mark token as used
  await supabase
    .from('password_resets')
    .update({ used: true })
    .eq('token', token);

    return {
      success: !!user,
      message: user ? 'Password changed successfully. Click the button below to log in.' : 'Unknown error. Failed to reset password.',
    };
}