import { Handler } from '@netlify/functions';
import nodemailer from 'nodemailer';
import { supabase, doesUserExist } from '../../src/lib/supabaseServer';
import { v4 as uuidv4 } from 'uuid';

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
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>FitTracker Password Reset</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
                  Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                background-color: #f4f7fa;
                margin: 0;
                padding: 0;
                color: #333;
              }
              .container {
                background: white;
                max-width: 600px;
                margin: 30px auto;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                width: 50px;
                height: 50px;
                margin-bottom: 10px;

                & path {
                  fill: rgb(59 130 246);
                }
              }
              h1 {
                color: #007BFF;
                font-weight: 700;
                margin: 0;
                font-size: 24px;
              }
              p {
                line-height: 1.6;
                font-size: 16px;
                margin: 20px 0;
              }
              .button {
                display: inline-block;
                background-color: #007BFF;
                color: white !important;
                padding: 12px 24px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                font-size: 16px;
                margin-top: 20px;
              }
              .footer {
                margin-top: 40px;
                font-size: 12px;
                color: #888;
                text-align: center;
              }
              @media screen and (max-width: 600px) {
                .container {
                  margin: 15px;
                  padding: 20px;
                }
                h1 {
                  font-size: 20px;
                }
                p {
                  font-size: 14px;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
              <svg xmlns="http://www.w3.org/2000/svg" class="logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dumbbell h-10 w-10 lg:h-12 lg:w-12 text-blue-600 dark:text-blue-400"><path d="m6.5 6.5 11 11"></path><path d="m21 21-1-1"></path><path d="m3 3 1 1"></path><path d="m18 22 4-4"></path><path d="m2 6 4-4"></path><path d="m3 10 7-7"></path><path d="m14 21 7-7"></path></svg>
                <h1>FitTracker Password Reset</h1>
              </div>

              <p>Hello,</p>

              <p>We received a request to reset the password for your FitTracker account.</p>

              <p>Click the button below to reset your password. This link will expire in 1 hour.</p>

              <p style="text-align:center;">
                <a href="${resetLink}" class="button" target="_blank" rel="noopener noreferrer">Reset Password</a>
              </p>

              <p>If you did not request this password reset, you can safely ignore this email. Your account will remain secure.</p>

              <p>Thank you,<br />The FitTracker Team</p>

              <div class="footer">
                &copy; 2025 FitTracker. All rights reserved.<br />
                If you need help, contact <a href="mailto:support@cadelawless.com">support@cadelawless.com</a>
              </div>
            </div>
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
