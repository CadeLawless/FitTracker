import { Handler } from '@netlify/functions';
import { resetPassword } from '../../src/lib/supabaseServer';

const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const { token, new_password } = JSON.parse(event.body || '{}');

  if (!token || !new_password) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Token and New Password are required' }),
    };
  }

  try {
    const result = await resetPassword(token, new_password);    

    return {
      statusCode: result.success ? 200 : 500,
      body: JSON.stringify({ message: result.message, success: result.success }),
    };
  } catch (error) {
    console.error('Error resetting password:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to reset password' }),
    };
  }
};

export { handler };
