// Goal setup component - shown after user registration
// This helps users set their fitness goals and starting metrics

import React, { useState } from 'react';
import { Target, Scale, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface GoalSetupProps {
  onComplete: () => void;
}

export default function GoalSetup({ onComplete }: GoalSetupProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    starting_weight: '',
    height_feet: '',
    height_inches: '',
    goal_type: '',
    target_weight: '',
    target_date: '',
    activity_level: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Calculate total height in inches
      const totalHeightInches = parseInt(formData.height_feet) * 12 + parseInt(formData.height_inches);

      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert([
          {
            user_id: user.id,
            height_inches: totalHeightInches,
            activity_level: formData.activity_level,
          },
        ]);

      if (profileError) {
        console.error('Profile error:', profileError);
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      // Create initial weight entry
      if (formData.starting_weight) {
        const { error: weightError } = await supabase
          .from('weight_entries')
          .insert([
            {
              user_id: user.id,
              weight: parseFloat(formData.starting_weight),
              date: new Date().toISOString().split('T')[0],
              notes: 'Starting weight',
            },
          ]);

        if (weightError) {
          console.error('Weight error:', weightError);
          throw new Error(`Failed to create weight entry: ${weightError.message}`);
        }
      }

      // Create goal
      if (formData.goal_type && formData.target_weight) {
        const { error: goalError } = await supabase
          .from('user_goals')
          .insert([
            {
              user_id: user.id,
              goal_type: formData.goal_type,
              starting_weight: parseFloat(formData.starting_weight),
              target_weight: parseFloat(formData.target_weight),
              target_date: formData.target_date || null,
              is_active: true,
            },
          ]);

        if (goalError) {
          console.error('Goal error:', goalError);
          throw new Error(`Failed to create goal: ${goalError.message}`);
        }
      }

      onComplete();
    } catch (err: any) {
      console.error('Setup error:', err);
      setError(err.message || 'An error occurred during setup');
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

  const goalTypes = [
    {
      id: 'cutting',
      name: 'Cutting',
      description: 'Lose weight while maintaining muscle',
      icon: TrendingDown,
      color: 'text-red-600 bg-red-50 border-red-200',
    },
    {
      id: 'bulking',
      name: 'Bulking',
      description: 'Gain weight to build muscle',
      icon: TrendingUp,
      color: 'text-green-600 bg-green-50 border-green-200',
    },
    {
      id: 'maintaining',
      name: 'Maintaining',
      description: 'Maintain weight, improve body composition',
      icon: Minus,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-6 lg:space-y-8 p-6 lg:p-8 bg-white rounded-xl shadow-lg">
        {/* Header */}
        <div className="text-center">
          <Target className="h-10 w-10 lg:h-12 lg:w-12 text-blue-600 mx-auto" />
          <h2 className="mt-4 text-2xl lg:text-3xl font-bold text-gray-900">Set Your Goals</h2>
          <p className="mt-2 text-sm text-gray-600">
            Let's personalize your fitness journey
          </p>
          <div className="mt-4 flex justify-center">
            <div className="flex space-x-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i <= step ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-8">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg lg:text-xl font-semibold text-gray-900">Basic Information</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div>
                  <label htmlFor="starting_weight" className="block text-sm font-medium text-gray-700">
                    Current Weight (lbs)
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="starting_weight"
                      name="starting_weight"
                      type="number"
                      step="0.1"
                      required
                      value={formData.starting_weight}
                      onChange={handleInputChange}
                      className="block w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                      placeholder="Enter your weight"
                    />
                    <Scale className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Height
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div>
                      <select
                        name="height_feet"
                        required
                        value={formData.height_feet}
                        onChange={handleInputChange}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                      >
                        <option value="">Feet</option>
                        {[4, 5, 6, 7].map(ft => (
                          <option key={ft} value={ft}>{ft} ft</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        name="height_inches"
                        required
                        value={formData.height_inches}
                        onChange={handleInputChange}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                      >
                        <option value="">Inches</option>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i} value={i}>{i} in</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="activity_level" className="block text-sm font-medium text-gray-700">
                  Activity Level
                </label>
                <select
                  id="activity_level"
                  name="activity_level"
                  required
                  value={formData.activity_level}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                >
                  <option value="">Select activity level</option>
                  <option value="sedentary">Sedentary (little/no exercise)</option>
                  <option value="lightly_active">Lightly Active (light exercise 1-3 days/week)</option>
                  <option value="moderately_active">Moderately Active (moderate exercise 3-5 days/week)</option>
                  <option value="very_active">Very Active (hard exercise 6-7 days/week)</option>
                  <option value="extremely_active">Extremely Active (very hard exercise, physical job)</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Goal Type */}
          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg lg:text-xl font-semibold text-gray-900">What's Your Goal?</h3>
              
              <div className="grid grid-cols-1 gap-3 lg:gap-4">
                {goalTypes.map((goal) => {
                  const Icon = goal.icon;
                  return (
                    <label
                      key={goal.id}
                      className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                        formData.goal_type === goal.id
                          ? goal.color
                          : 'border-gray-300 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="goal_type"
                        value={goal.id}
                        checked={formData.goal_type === goal.id}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <div className="flex items-center">
                        <Icon className="h-5 w-5 lg:h-6 lg:w-6 mr-3 lg:mr-4 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium">{goal.name}</div>
                          <div className="text-sm text-gray-500">{goal.description}</div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Target */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg lg:text-xl font-semibold text-gray-900">Set Your Target</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div>
                  <label htmlFor="target_weight" className="block text-sm font-medium text-gray-700">
                    Target Weight (lbs)
                  </label>
                  <input
                    id="target_weight"
                    name="target_weight"
                    type="number"
                    step="0.1"
                    required
                    value={formData.target_weight}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                    placeholder="Enter target weight"
                  />
                </div>

                <div>
                  <label htmlFor="target_date" className="block text-sm font-medium text-gray-700">
                    Target Date (optional)
                  </label>
                  <input
                    id="target_date"
                    name="target_date"
                    type="date"
                    value={formData.target_date}
                    onChange={handleInputChange}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                  />
                </div>
              </div>

              {formData.starting_weight && formData.target_weight && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Target className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Goal: {formData.goal_type === 'cutting' ? 'Lose' : formData.goal_type === 'bulking' ? 'Gain' : 'Maintain'} {' '}
                        {Math.abs(parseFloat(formData.target_weight) - parseFloat(formData.starting_weight)).toFixed(1)} lbs
                      </p>
                      <p className="text-xs text-blue-700">
                        From {formData.starting_weight} lbs to {formData.target_weight} lbs
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm lg:text-base"
              >
                Previous
              </button>
            )}
            
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && (!formData.starting_weight || !formData.height_feet || !formData.height_inches || !formData.activity_level)) ||
                  (step === 2 && !formData.goal_type)
                }
                className="sm:ml-auto flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !formData.target_weight}
                className="sm:ml-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
              >
                {loading ? 'Setting up...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}