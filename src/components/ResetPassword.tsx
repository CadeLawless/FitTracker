// Authentication form component
// This handles user login and registration with enhanced profile fields

import React, { useState, useEffect } from 'react';
import { Dumbbell, Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase, auth } from '../lib/supabase';
import FormInput from './ui/FormInput';

type Theme = 'light' | 'dark';

interface passwordReset {
  user_id: string;
  expires_at: string;
  used: boolean;
};

export default function ResetPassword() {
  const [theme, setTheme] = useState<Theme>(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme: Theme = prefersDark ? 'dark' : 'light';
    return defaultTheme;
  });

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [passwordReset, setPasswordReset] = useState<passwordReset|null>(null);

  const [message, setMessage] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    new_password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (!!token === false) return;
      
      // Find password reset information
      const { data: resetData, error: passwordResetError } = await supabase
        .from('password_resets')
        .select(`
          user_id,
          expires_at,
          used
        `)
        .eq('token', token)
        .maybeSingle();

      if (passwordResetError) throw passwordResetError;

      if(resetData) setPasswordReset(resetData);

    } catch (error:any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Apply theme to document
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if(formData.new_password !== formData.confirm_password){
        throw {message: 'New Password and Confirm New Password must match'};
      }

      const res = await fetch('/.netlify/functions/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: formData.new_password }),
      });
  
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const now = new Date();
  const expiresAt = new Date(passwordReset?.expires_at || '');

  const resetExpired = passwordReset ? expiresAt < now : false;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-md w-full my-3 space-y-6 lg:space-y-8 p-6 lg:p-8 bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-xl shadow-lg">
        {/* Header */}
        <div className='text-right'>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </button>
        </div>
        <div className="text-center">
          <div className="flex justify-center">
            <Dumbbell className="h-10 w-10 lg:h-12 lg:w-12 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="mt-4 text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">FitTracker</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300">
            Reset your password
          </p>
        </div>

        {!passwordReset || (resetExpired || passwordReset.used) && 
          <div>
            <div className="bg-red-50 dark:bg-red-500/10 dark:bg-red-900/50 border border-red-200 dark:border-red-400/40 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {!passwordReset ? 'No password reset found.' : (resetExpired ? 'Password reset has expired.' : 'Password reset already used.')} Go to Login and click Forgot Password to send a new reset link to your email.
            </div>
            <div className='text-center'>
              <Link
                to={'/'}
                className="inline-block mt-4 py-2.5 lg:py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Go to Login
              </Link>
            </div>
          </div>
        }

        {passwordReset && !resetExpired && !passwordReset.used &&
          <>
            {/* Form */}
            <form className="mt-6 lg:mt-8 space-y-4 lg:space-y-6" onSubmit={handleSubmit}>

              {message &&
                <div className="bg-green-50 dark:bg-green-500/10 dark:bg-green-900/50 border border-green-200 dark:border-green-400/40 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
                  {message}
                </div>
              }

              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 dark:bg-red-900/50 border border-red-200 dark:border-red-400/40 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                    <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-300">
                    New Password
                    </label>
                    <div className="mt-1 relative">
                    <FormInput
                        id="new_password"
                        name="new_password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.new_password}
                        onChange={handleInputChange}
                        className="pr-10"
                        placeholder="Enter your password"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-[50%] translate-y-[-50%] right-0 pr-3 flex items-center"
                    >
                        {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        ) : (
                        <Eye className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        )}
                    </button>
                    </div>
                </div>
                <div>
                    <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-300">
                    Confirm New Password
                    </label>
                    <div className="mt-1 relative">
                        <FormInput
                            id="confirm_password"
                            name="confirm_password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={formData.confirm_password}
                            onChange={handleInputChange}
                            className="pr-10"
                            placeholder="Enter your password"
                        />
                    </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 lg:py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading...' : 'Reset Password'}
              </button>
            </form>
          </>
        }
      </div>
    </div>
  );
}