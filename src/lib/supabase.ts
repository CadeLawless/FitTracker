// Supabase client setup - this is our database connection
// Supabase is a modern alternative to traditional databases like MySQL
// It provides real-time features and is much easier to set up

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper functions for authentication
export const auth = {
  signUp: async (email: string, password: string, name: string, birth_date?: string, gender?: 'male' | 'female' | 'other') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          birth_date,
          gender,
        },
      },
    });
    return { data, error };
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },
};

// Body fat calculation utilities
export const bodyFatCalculations = {
  // Navy Method for body fat calculation
  calculateBodyFat: (
    gender: 'male' | 'female',
    waist: number, // inches
    neck: number, // inches
    height: number, // inches
    hips?: number // inches (required for females)
  ): number => {
    if (gender === 'male') {
      // Male formula: 495 / (1.0324 - 0.19077 * log10(waist - neck) + 0.15456 * log10(height)) - 450
      const log10WaistNeck = Math.log10(waist - neck);
      const log10Height = Math.log10(height);
      return 495 / (1.0324 - 0.19077 * log10WaistNeck + 0.15456 * log10Height) - 450;
    } else {
      // Female formula: 495 / (1.29579 - 0.35004 * log10(waist + hips - neck) + 0.22100 * log10(height)) - 450
      if (!hips) throw new Error('Hips measurement required for female body fat calculation');
      const log10WaistHipsNeck = Math.log10(waist + hips - neck);
      const log10Height = Math.log10(height);
      return 495 / (1.29579 - 0.35004 * log10WaistHipsNeck + 0.22100 * log10Height) - 450;
    }
  },

  // BMI calculation
  calculateBMI: (weight: number, height: number): number => {
    // weight in lbs, height in inches
    return (weight / (height * height)) * 703;
  },

  // BMR calculation using Mifflin-St Jeor Equation
  calculateBMR: (
    gender: 'male' | 'female',
    weight: number, // lbs
    height: number, // inches
    age: number
  ): number => {
    // Convert to metric
    const weightKg = weight * 0.453592;
    const heightCm = height * 2.54;

    if (gender === 'male') {
      return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    } else {
      return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    }
  },

  // TDEE calculation
  calculateTDEE: (bmr: number, activityLevel: string): number => {
    const multipliers = {
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725,
      extremely_active: 1.9,
    };
    return bmr * (multipliers[activityLevel as keyof typeof multipliers] || 1.2);
  },
};