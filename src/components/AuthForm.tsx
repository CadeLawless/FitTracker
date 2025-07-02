// Authentication form component
// This handles user login and registration with enhanced profile fields

import React, { useState } from 'react';
import { Dumbbell, Eye, EyeOff, Calendar, User } from 'lucide-react';
import { auth } from '../lib/supabase';

interface AuthFormProps {
  onAuthSuccess: () => void;
}

export default function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    birth_date: '',
    gender: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { error } = await auth.signIn(formData.email, formData.password);
        if (error) throw error;
      } else {
        const { error } = await auth.signUp(
          formData.email, 
          formData.password, 
          formData.name,
          formData.birth_date,
          formData.gender as 'male' | 'female' | 'other'
        );
        if (error) throw error;
      }
      onAuthSuccess();
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 lg:space-y-8 p-6 lg:p-8 bg-white rounded-xl shadow-lg">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <Dumbbell className="h-10 w-10 lg:h-12 lg:w-12 text-blue-600" />
          </div>
          <h2 className="mt-4 text-2xl lg:text-3xl font-bold text-gray-900">FitTracker</h2>
          <p className="mt-2 text-sm text-gray-600">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        {/* Form */}
        <form className="mt-6 lg:mt-8 space-y-4 lg:space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required={!isLogin}
                      value={formData.name}
                      onChange={handleInputChange}
                      className="block w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                      placeholder="Enter your full name"
                    />
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700">
                    Birth Date
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="birth_date"
                      name="birth_date"
                      type="date"
                      required={!isLogin}
                      value={formData.birth_date}
                      onChange={handleInputChange}
                      className="block w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                    />
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                    Gender
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    required={!isLogin}
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 lg:py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}