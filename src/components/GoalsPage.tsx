import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, Save, Edit2, Plus, Calendar, Scale, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/date';
import type { UserGoal, WeightEntry } from '../types';

export default function GoalsPage() {
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [activeGoal, setActiveGoal] = useState<UserGoal | null>(null);
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<UserGoal | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    goal_type: '',
    target_weight: '',
    target_date: '',
    weekly_goal: '',
  });

  useEffect(() => {
    loadGoalsData();
  }, []);

  const loadGoalsData = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Load goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.data.user.id)
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      // Load latest weight
      const { data: weightData, error: weightError } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', user.data.user.id)
        .order('date', { ascending: false })
        .limit(1);

      if (weightError) throw weightError;

      setGoals(goalsData || []);
      setActiveGoal(goalsData?.find(g => g.is_active) || null);
      setLatestWeight(weightData?.[0] || null);
    } catch (error) {
      console.error('Error loading goals data:', error);
      setError('Failed to load goals data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const goalData = {
        user_id: user.data.user.id,
        goal_type: formData.goal_type,
        starting_weight: latestWeight?.weight || null,
        target_weight: parseFloat(formData.target_weight),
        target_date: formData.target_date || null,
        weekly_goal: formData.weekly_goal ? parseFloat(formData.weekly_goal) : null,
        is_active: true,
      };

      if (editingGoal) {
        // Update existing goal
        const { error } = await supabase
          .from('user_goals')
          .update(goalData)
          .eq('id', editingGoal.id);

        if (error) throw error;
        setSuccess('Goal updated successfully!');
      } else {
        // Deactivate current active goal
        if (activeGoal) {
          await supabase
            .from('user_goals')
            .update({ is_active: false })
            .eq('id', activeGoal.id);
        }

        // Create new goal
        const { error } = await supabase
          .from('user_goals')
          .insert([goalData]);

        if (error) throw error;
        setSuccess('New goal created successfully!');
      }

      resetForm();
      loadGoalsData();
    } catch (error: any) {
      console.error('Error saving goal:', error);
      setError(error.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (goal: UserGoal) => {
    setEditingGoal(goal);
    setFormData({
      goal_type: goal.goal_type,
      target_weight: goal.target_weight?.toString() || '',
      target_date: goal.target_date || '',
      weekly_goal: goal.weekly_goal?.toString() || '',
    });
    setShowForm(true);
  };

  const handleSetActive = async (goalId: string) => {
    try {
      // Deactivate all goals
      await supabase
        .from('user_goals')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

      // Activate selected goal
      const { error } = await supabase
        .from('user_goals')
        .update({ is_active: true })
        .eq('id', goalId);

      if (error) throw error;
      
      setSuccess('Active goal updated!');
      loadGoalsData();
    } catch (error) {
      console.error('Error setting active goal:', error);
      setError('Failed to update active goal');
    }
  };

  const resetForm = () => {
    setFormData({
      goal_type: '',
      target_weight: '',
      target_date: '',
      weekly_goal: '',
    });
    setShowForm(false);
    setEditingGoal(null);
  };

  const getGoalProgress = (goal: UserGoal) => {
    if (!latestWeight || !goal.starting_weight || !goal.target_weight) return null;

    const totalChange = goal.target_weight - goal.starting_weight;
    const currentChange = latestWeight.weight - goal.starting_weight;
    const progressPercentage = Math.abs(totalChange) > 0 ? (currentChange / totalChange) * 100 : 0;

    return {
      progressPercentage: Math.min(Math.max(progressPercentage, 0), 100),
      currentChange,
      totalChange,
      remaining: goal.target_weight - latestWeight.weight,
    };
  };

  const getProgressColor = (goal: UserGoal, change: number) => {
    if (change === 0) return 'text-gray-600';
    
    switch (goal.goal_type) {
      case 'cutting':
        return change < 0 ? 'text-green-600' : 'text-red-600';
      case 'bulking':
        return change > 0 ? 'text-green-600' : 'text-red-600';
      case 'maintaining':
        return Math.abs(change) <= 2 ? 'text-green-600' : 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  const getProgressIcon = (goal: UserGoal, change: number) => {
    if (change === 0) return Minus;
    
    const isPositive = change > 0;
    const isGoodProgress = 
      (goal.goal_type === 'cutting' && change < 0) ||
      (goal.goal_type === 'bulking' && change > 0) ||
      (goal.goal_type === 'maintaining' && Math.abs(change) <= 2);

    if (isPositive) {
      return isGoodProgress ? TrendingUp : TrendingUp;
    } else {
      return isGoodProgress ? TrendingDown : TrendingDown;
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Goals</h1>
          <p className="mt-2 text-sm lg:text-base text-gray-600">Manage your fitness goals and track your progress.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm lg:text-base"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Goal
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span className="text-sm lg:text-base">{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span className="text-sm lg:text-base">{error}</span>
        </div>
      )}

      {/* Current Active Goal */}
      {activeGoal && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Target className="h-6 w-6 text-blue-600 mr-3" />
              <div>
                <h3 className="text-base lg:text-lg font-semibold text-gray-900">Current Active Goal</h3>
                <p className="text-sm text-gray-600 capitalize">{activeGoal.goal_type} Goal</p>
              </div>
            </div>
            <button
              onClick={() => handleEdit(activeGoal)}
              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
          
          {(() => {
            const progress = getGoalProgress(activeGoal);
            if (!progress) return null;

            const ProgressIcon = getProgressIcon(activeGoal, progress.currentChange);
            const progressColor = getProgressColor(activeGoal, progress.currentChange);

            return (
              <>
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{activeGoal.starting_weight} lbs</span>
                    <span>{activeGoal.target_weight} lbs</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(progress.progressPercentage, 100)}%` }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Current Weight</p>
                    <p className="font-semibold text-gray-900">{latestWeight?.weight} lbs</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Progress</p>
                    <div className="flex items-center">
                      <ProgressIcon className={`h-4 w-4 mr-1 ${progressColor}`} />
                      <p className={`font-semibold ${progressColor}`}>
                        {progress.currentChange > 0 ? '+' : ''}{progress.currentChange.toFixed(1)} lbs
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-600">Remaining</p>
                    <p className="font-semibold text-gray-900">
                      {Math.abs(progress.remaining).toFixed(1)} lbs
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Completion</p>
                    <p className="font-semibold text-gray-900">
                      {progress.progressPercentage.toFixed(0)}%
                    </p>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Goal Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base lg:text-lg font-semibold text-gray-900">
              {editingGoal ? 'Edit Goal' : 'Create New Goal'}
            </h2>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <Plus className="h-5 w-5 rotate-45" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Goal Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Goal Type
              </label>
              <div className="grid grid-cols-1 gap-3">
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
                        onChange={(e) => setFormData({ ...formData, goal_type: e.target.value })}
                        className="sr-only"
                        required
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

            {/* Target Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label htmlFor="target_weight" className="block text-sm font-medium text-gray-700">
                  Target Weight (lbs)
                </label>
                <input
                  type="number"
                  id="target_weight"
                  step="0.1"
                  required
                  value={formData.target_weight}
                  onChange={(e) => setFormData({ ...formData, target_weight: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                  placeholder="Enter target weight"
                />
              </div>

              <div>
                <label htmlFor="target_date" className="block text-sm font-medium text-gray-700">
                  Target Date (optional)
                </label>
                <input
                  type="date"
                  id="target_date"
                  value={formData.target_date}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                />
              </div>
            </div>

            <div>
              <label htmlFor="weekly_goal" className="block text-sm font-medium text-gray-700">
                Weekly Goal (lbs per week, optional)
              </label>
              <input
                type="number"
                id="weekly_goal"
                step="0.1"
                value={formData.weekly_goal}
                onChange={(e) => setFormData({ ...formData, weekly_goal: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                placeholder="e.g., 1.0 for cutting, 0.5 for bulking"
              />
            </div>

            {/* Current Weight Info */}
            {latestWeight && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <Scale className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Starting from current weight: {latestWeight.weight} lbs
                    </p>
                    <p className="text-xs text-blue-700">
                      Logged on {formatDate(latestWeight.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm lg:text-base"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : (editingGoal ? 'Update Goal' : 'Create Goal')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Goals History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900">Goals History</h2>
        </div>
        <div className="p-4 lg:p-6">
          {goals.length > 0 ? (
            <div className="space-y-4">
              {goals.map((goal) => {
                const progress = getGoalProgress(goal);
                const ProgressIcon = progress ? getProgressIcon(goal, progress.currentChange) : Minus;
                const progressColor = progress ? getProgressColor(goal, progress.currentChange) : 'text-gray-600';

                return (
                  <div
                    key={goal.id}
                    className={`p-4 border rounded-lg transition-colors ${
                      goal.is_active 
                        ? 'border-blue-200 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-gray-900 capitalize">
                            {goal.goal_type} Goal
                          </h3>
                          {goal.is_active && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Target:</span> {goal.target_weight} lbs
                          </div>
                          {goal.target_date && (
                            <div>
                              <span className="font-medium">By:</span> {formatDate(goal.target_date).toLocaleDateString()}
                            </div>
                          )}
                          {progress && (
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Progress:</span>
                              <ProgressIcon className={`h-4 w-4 mr-1 ${progressColor}`} />
                              <span className={progressColor}>
                                {progress.currentChange > 0 ? '+' : ''}{progress.currentChange.toFixed(1)} lbs
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Created:</span> {formatDate(goal.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {!goal.is_active && (
                          <button
                            onClick={() => handleSetActive(goal.id)}
                            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(goal)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 lg:py-12">
              <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2 text-sm lg:text-base">No goals set yet</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Create your first goal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}