import { Handler } from '@netlify/functions';
import nodemailer from 'nodemailer';
import { supabase, doesUserExist } from '../../src/lib/supabaseServer';
import { v4 as uuidv4 } from 'uuid';

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY);

const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const { email } = JSON.parse(event.body || '{}');

  if (!email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Email is required' }),
    };
  }

  try {
    const userId = await doesUserExist(email);

    if (userId !== false) {
      // Delete all previous password resets/tokens with same email
      const { error: deleteError } = await supabase
      .from('password_resets')
      .delete()
      .eq('email', email);

      if (deleteError) throw deleteError;

      const resetToken = uuidv4();

      const { error: insertError } = await supabase
      .from('password_resets')
      .insert([
        {
          user_id: userId,
          email: email,
          token: resetToken,
          expires_at: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
        },
      ]);

      if (insertError) throw insertError;

      const transporter = nodemailer.createTransport({
        host: 'smtp.ionos.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const resetLink = `https://fittracker.cadelawless.com/reset-password?token=${resetToken}`;

      await transporter.sendMail({
        from: '"FitTracker" <support@cadelawless.com>',
        to: email,
        subject: 'Password Reset',
        text: `Click the link to reset your password: ${resetLink}`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
            <body style="margin:0; padding:0; background-color:#f4f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; color:#333;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f4f7fa; padding:30px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background:#fff; border-radius:8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding:30px;">
                      <tr>
                        <td align="center" style="padding-bottom:30px;">
                          <!-- Simple text fallback logo -->
                          <div style="font-weight:bold; font-size:28px; color:#3b82f6; margin-bottom:10px; font-family: Arial, sans-serif;">🏋️‍♂️</div>
                          <h1 style="color:#007BFF; font-weight:700; margin:0; font-size:24px;">FitTracker Password Reset</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:16px; line-height:1.6; padding-bottom:20px;">
                          Hello,
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:16px; line-height:1.6; padding-bottom:20px;">
                          We received a request to reset the password for your FitTracker account.
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:16px; line-height:1.6; padding-bottom:20px;">
                          Click the button below to reset your password. This link will expire in 1 hour.
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-bottom:20px;">
                          <a href="${resetLink}" target="_blank" rel="noopener noreferrer"
                            style="background-color:#007BFF; color:#ffffff !important; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:600; font-size:16px; display:inline-block;">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:16px; line-height:1.6; padding-bottom:20px;">
                          If you did not request this password reset, you can safely ignore this email. Your account will remain secure.
                        </td>
                      </tr>
                      <tr>
                        <td style="font-size:16px; line-height:1.6; padding-bottom:20px;">
                          Thank you,<br>
                          The FitTracker Team
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="font-size:12px; color:#888888;">
                          &copy; 2025 FitTracker. All rights reserved.<br>
                          If you need help, contact <a href="mailto:support@cadelawless.com" style="color:#888888; text-decoration:underline;">support@cadelawless.com</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'If an account exists for that email address, a password reset link has been sent' }),
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send email' }),
    };
  }
};

export { handler };
