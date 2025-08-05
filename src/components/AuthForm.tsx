// Authentication form component
// This handles user login and registration with enhanced profile fields

import React, { useState, useEffect } from 'react';
import { Dumbbell, Eye, EyeOff, Calendar, User, Moon, Sun, ChevronLeft } from 'lucide-react';
import { auth } from '../lib/supabase';
import FormInput from './ui/FormInput';

type Theme = 'light' | 'dark';

interface AuthFormProps {
  onAuthSuccess: () => void;
}

export default function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [theme, setTheme] = useState(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme: Theme = prefersDark ? 'dark' : 'light';
    return defaultTheme;
  });
  const [formType, setFormType] = useState<'login'|'sign-up'|'forgot-password'>('login');
  const [message, setMessage] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    birth_date: '',
    gender: '',
  });
  const [error, setError] = useState('');

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

    try {
      if (formType === 'login') {
        const { error } = await auth.signIn(formData.email, formData.password);
        if (error) throw error;
      } else if (formType === 'sign-up') {
        const { error } = await auth.signUp(
          formData.email, 
          formData.password, 
          formData.name,
          formData.birth_date,
          formData.gender as 'male' | 'female' | 'other'
        );

        if (error) throw error;
      } else if (formType === 'forgot-password') {
        const res = await fetch('/api/send-reset-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email }),
        });
    
        const data = await res.json();
        setMessage(data.message);
      }
      if(formType !== 'forgot-password') onAuthSuccess();
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
            {formType === 'login' ? 'Sign in to your account' : (formType === 'sign-up' ? 'Create your account' : 'Reset your password')}
          </p>
        </div>

        {/* Form */}
        <form className="mt-6 lg:mt-8 space-y-4 lg:space-y-6" onSubmit={handleSubmit}>

          {formType === 'forgot-password' && (
            <>
              <button
                type="button"
                onClick={() => setFormType('login')}
                className="text-sm flex gap-1 items-center text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to login
              </button>

              {message && <p>{message}</p>}
            </>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 dark:bg-red-900/50 border border-red-200 dark:border-red-400/40 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {formType === 'sign-up' && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-300">
                    Full Name
                  </label>
                  <div className="mt-1 relative">
                    <FormInput
                      id="name"
                      name="name"
                      type="text"
                      required={formType === 'sign-up'}
                      value={formData.name}
                      onChange={handleInputChange}
                      className="pl-10"
                      placeholder="Enter your full name"
                    />
                    <User className="absolute left-3 top-[50%] translate-y-[-50%] h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>

                <div>
                  <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-300">
                    Birth Date
                  </label>
                  <div className="mt-1 relative">
                    <FormInput
                      id="birth_date"
                      name="birth_date"
                      type="date"
                      required={formType === 'sign-up'}
                      value={formData.birth_date}
                      onChange={handleInputChange}
                      className="pl-10"
                    />
                    <Calendar className="absolute left-3 top-[50%] translate-y-[-50%] h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>

                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-300">
                    Gender
                  </label>
                  <FormInput
                    inputType='select'
                    id="gender"
                    name="gender"
                    required={formType === 'sign-up'}
                    value={formData.gender}
                    onChange={handleInputChange}
                  >
                    <>
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </>
                  </FormInput>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-300">
                Email Address
              </label>
              <FormInput
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
              />
            </div>

            {formType !== 'forgot-password' && (
              <>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-300">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <FormInput
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
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
                  {formType === 'login' && (
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => setFormType('forgot-password')}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 lg:py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : (formType === 'login' ? 'Sign In' : (formType === 'forgot-password' ? 'Send Reset Link' : 'Create Account'))}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setFormType(formType === 'login' ? 'sign-up' : 'login')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
            >
              {formType === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}