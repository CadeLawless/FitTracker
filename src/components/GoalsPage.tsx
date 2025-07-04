import React, { useState, useEffect, useRef } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, Save, Edit2, Plus, Calendar, Scale, CheckCircle, AlertCircle, Ruler, X, Trash2, Check, AlertTriangle, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/date';
import type { UserGoal, WeightEntry, MeasurementField, BodyMeasurement, UserProfile } from '../types';

interface DeleteConfirmation {
  isOpen: boolean;
  goalId: string | null;
  goalName: string;
}

interface CompleteConfirmation {
  isOpen: boolean;
  goalId: string | null;
  goalName: string;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [activeGoals, setActiveGoals] = useState<UserGoal[]>([]);
  const [measurementFields, setMeasurementFields] = useState<MeasurementField[]>([]);
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null);
  const [latestMeasurements, setLatestMeasurements] = useState<BodyMeasurement | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<UserGoal | null>(null);
  const [editingPhase, setEditingPhase] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>({
    isOpen: false,
    goalId: null,
    goalName: '',
  });

  const [completeConfirmation, setCompleteConfirmation] = useState<CompleteConfirmation>({
    isOpen: false,
    goalId: null,
    goalName: '',
  });

  const [formData, setFormData] = useState({
    goal_category: 'weight',
    target_weight: '',
    target_value: '',
    measurement_field_id: '',
    target_date: '',
    weekly_goal: '',
  });

  const [phaseData, setPhaseData] = useState({
    fitness_phase: 'none',
  });

  // Ref for the form section to enable auto-scrolling
  const formRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    loadGoalsData();
  }, []);

  useEffect(() => {
    if (showForm && formRef.current) {
      const y = formRef.current.getBoundingClientRect().top + window.pageYOffset - 80;

      window.scrollTo({
        top: y,
        behavior: 'smooth',
      });
    }
  }, [showForm]);

  useEffect(() => {
    if (success !== '') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  }, [success]);

  const loadGoalsData = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Load user profile with fitness phase
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.data.user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      setUserProfile(profileData);
      setPhaseData({
        fitness_phase: profileData?.fitness_phase || 'none',
      });

      // Load goals with measurement field info
      const { data: goalsData, error: goalsError } = await supabase
        .from('user_goals')
        .select(`
          *,
          measurement_field:measurement_fields(*)
        `)
        .eq('user_id', user.data.user.id)
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      // Load measurement fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('measurement_fields')
        .select('*')
        .eq('user_id', user.data.user.id)
        .eq('is_active', true)
        .order('field_name');

      if (fieldsError) throw fieldsError;

      // Load latest weight
      const { data: weightData, error: weightError } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', user.data.user.id)
        .order('date', { ascending: false })
        .limit(1);

      if (weightError) throw weightError;

      // Load latest measurements
      const { data: measurementData, error: measurementError } = await supabase
        .from('body_measurement_entries')
        .select(`
          *,
          values:body_measurement_values(
            *,
            field:measurement_fields(*)
          )
        `)
        .eq('user_id', user.data.user.id)
        .order('date', { ascending: false })
        .limit(1);

      if (measurementError) throw measurementError;

      setGoals(goalsData || []);
      setActiveGoals(goalsData?.filter(g => g.is_active) || []);
      setMeasurementFields(fieldsData || []);
      setLatestWeight(weightData?.[0] || null);
      setLatestMeasurements(measurementData?.[0] || null);
    } catch (error) {
      console.error('Error loading goals data:', error);
      setError('Failed to load goals data');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentValue = (goal: UserGoal) => {
    if (goal.goal_category === 'weight') {
      return latestWeight?.weight || null;
    } else if (goal.measurement_field_id && latestMeasurements) {
      const value = latestMeasurements.values?.find(
        v => v.field_id === goal.measurement_field_id
      );
      return value?.value || null;
    }
    return null;
  };

  const getStartingValue = (goal: UserGoal) => {
    if (goal.goal_category === 'weight') {
      return goal.starting_weight || null;
    } else {
      return goal.starting_value || null;
    }
  };

  const getTargetValue = (goal: UserGoal) => {
    if (goal.goal_category === 'weight') {
      return goal.target_weight || null;
    } else {
      return goal.target_value || null;
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

      let goalData: any = {
        user_id: user.data.user.id,
        goal_category: formData.goal_category,
        target_date: formData.target_date || null,
        weekly_goal: formData.weekly_goal ? parseFloat(formData.weekly_goal) : null,
        is_active: true,
      };

      if (formData.goal_category === 'weight') {
        goalData.starting_weight = latestWeight?.weight || null;
        goalData.target_weight = parseFloat(formData.target_weight);
        goalData.measurement_field_id = null;
        goalData.starting_value = null;
        goalData.target_value = null;
      } else {
        // Get current value for this measurement field
        const currentValue = latestMeasurements?.values?.find(
          v => v.field_id === formData.measurement_field_id
        )?.value;

        goalData.measurement_field_id = formData.measurement_field_id;
        goalData.starting_value = currentValue || null;
        goalData.target_value = parseFloat(formData.target_value);
        goalData.starting_weight = null;
        goalData.target_weight = null;
      }

      if (editingGoal) {
        // Update existing goal
        const { error } = await supabase
          .from('user_goals')
          .update(goalData)
          .eq('id', editingGoal.id);

        if (error) throw error;
        setSuccess('Goal updated successfully!');
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      } else {
        // Deactivate current active goals of the same category
        const activeGoalsOfCategory = activeGoals.filter(g => g.goal_category === formData.goal_category);
        if (activeGoalsOfCategory.length > 0) {
          await supabase
            .from('user_goals')
            .update({ is_active: false })
            .in('id', activeGoalsOfCategory.map(g => g.id));
        }

        // Create new goal
        const { error } = await supabase
          .from('user_goals')
          .insert([goalData]);

        if (error) throw error;
        setSuccess('New goal created successfully!');
        setTimeout(() => {
          setSuccess('');
        }, 5000);
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

  const handlePhaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      if (userProfile) {
        // Update existing profile
        const { error } = await supabase
          .from('user_profiles')
          .update({
            fitness_phase: phaseData.fitness_phase,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userProfile.id);

        if (error) throw error;
      } else {
        // Create new profile
        const { error } = await supabase
          .from('user_profiles')
          .insert([{
            user_id: user.data.user.id,
            fitness_phase: phaseData.fitness_phase,
          }]);

        if (error) throw error;
      }

      setSuccess('Fitness phase updated successfully!');
      setTimeout(() => {
        setSuccess('');
      }, 5000);
      setEditingPhase(false);
      loadGoalsData();
    } catch (error: any) {
      console.error('Error updating fitness phase:', error);
      setError(error.message || 'Failed to update fitness phase');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (goal: UserGoal) => {
    setEditingGoal(goal);
    setFormData({
      goal_category: goal.goal_category,
      target_weight: goal.target_weight?.toString() || '',
      target_value: goal.target_value?.toString() || '',
      measurement_field_id: goal.measurement_field_id || '',
      target_date: goal.target_date || '',
      weekly_goal: goal.weekly_goal?.toString() || '',
    });
    setShowForm(true);
  };

  const handleSetActive = async (goalId: string, category: string) => {
    try {
      // Deactivate all goals of the same category
      await supabase
        .from('user_goals')
        .update({ is_active: false })
        .eq('goal_category', category)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      // Activate selected goal
      const { error } = await supabase
        .from('user_goals')
        .update({ is_active: true })
        .eq('id', goalId);

      if (error) throw error;
      
      setSuccess('Active goal updated!');
      setTimeout(() => {
          setSuccess('');
        }, 5000);
      loadGoalsData();
    } catch (error) {
      console.error('Error setting active goal:', error);
      setError('Failed to update active goal');
    }
  };

  const handleDeleteClick = (goal: UserGoal) => {
    const goalName = goal.goal_category === 'weight' 
      ? `Weight Goal` 
      : `${goal.measurement_field?.field_name} Goal`;
    
    setDeleteConfirmation({
      isOpen: true,
      goalId: goal.id,
      goalName,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation.goalId) return;

    try {
      const { error } = await supabase
        .from('user_goals')
        .delete()
        .eq('id', deleteConfirmation.goalId);

      if (error) throw error;
      
      setSuccess('Goal deleted successfully!');
      setTimeout(() => {
          setSuccess('');
        }, 5000);
      loadGoalsData();
    } catch (error) {
      console.error('Error deleting goal:', error);
      setError('Failed to delete goal');
    } finally {
      setDeleteConfirmation({ isOpen: false, goalId: null, goalName: '' });
    }
  };

  const handleCompleteClick = (goal: UserGoal) => {
    const goalName = goal.goal_category === 'weight' 
      ? `Weight Goal` 
      : `${goal.measurement_field?.field_name} Goal`;
    
    setCompleteConfirmation({
      isOpen: true,
      goalId: goal.id,
      goalName,
    });
  };

  const handleCompleteConfirm = async () => {
    if (!completeConfirmation.goalId) return;

    try {
      const { error } = await supabase
        .from('user_goals')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', completeConfirmation.goalId);

      if (error) throw error;
      
      setSuccess('Goal marked as complete! 🎉');
      setTimeout(() => {
          setSuccess('');
        }, 5000);
      loadGoalsData();
    } catch (error) {
      console.error('Error completing goal:', error);
      setError('Failed to mark goal as complete');
    } finally {
      setCompleteConfirmation({ isOpen: false, goalId: null, goalName: '' });
    }
  };

  const resetForm = () => {
    setFormData({
      goal_category: 'weight',
      target_weight: '',
      target_value: '',
      measurement_field_id: '',
      target_date: '',
      weekly_goal: '',
    });
    setShowForm(false);
    setEditingGoal(null);
  };

  const getGoalProgress = (goal: UserGoal) => {
    const currentValue = getCurrentValue(goal);
    const startingValue = getStartingValue(goal);
    const targetValue = getTargetValue(goal);

    if (!currentValue || !startingValue || !targetValue) return null;

    const totalChange = targetValue - startingValue;
    const currentChange = currentValue - startingValue;
    const progressPercentage = Math.abs(totalChange) > 0 ? (currentChange / totalChange) * 100 : 0;

    return {
      progressPercentage: Math.min(Math.max(progressPercentage, 0), 100),
      currentChange,
      totalChange,
      remaining: targetValue - currentValue,
      currentValue,
      startingValue,
      targetValue,
    };
  };

  const getProgressColor = (goal: UserGoal, change: number) => {
    if (change === 0) return 'text-gray-600';
    
    // For individual goals, determine if we're moving toward the target
    const targetValue = getTargetValue(goal);
    const startingValue = getStartingValue(goal);
    
    if (targetValue && startingValue) {
      const targetDirection = targetValue > startingValue ? 'increase' : 'decrease';
      const actualDirection = change > 0 ? 'increase' : 'decrease';
      return targetDirection === actualDirection ? 'text-green-600' : 'text-red-600';
    }
    
    return 'text-gray-600';
  };

  const getProgressIcon = (goal: UserGoal, change: number) => {
    if (change === 0) return Minus;
    return change > 0 ? TrendingUp : TrendingDown;
  };

  const getGoalUnit = (goal: UserGoal) => {
    if (goal.goal_category === 'weight') {
      return 'lbs';
    }
    return goal.measurement_field?.unit || '';
  };

  const getFitnessPhaseLabel = (phase: string) => {
    const labels = {
      cutting: 'Cutting',
      bulking: 'Bulking', 
      maintaining: 'Maintaining',
      none: 'No specific phase',
    };
    return labels[phase as keyof typeof labels] || phase;
  };

  const getFitnessPhaseDescription = (phase: string) => {
    const descriptions = {
      cutting: 'Focused on losing weight and reducing body fat',
      bulking: 'Focused on gaining weight and building muscle',
      maintaining: 'Focused on maintaining current weight and body composition',
      none: 'Just living life without a specific fitness focus',
    };
    return descriptions[phase as keyof typeof descriptions] || '';
  };

  const getFitnessPhaseColor = (phase: string) => {
    const colors = {
      cutting: 'text-red-600 bg-red-50 border-red-200',
      bulking: 'text-green-600 bg-green-50 border-green-200',
      maintaining: 'text-blue-600 bg-blue-50 border-blue-200',
      none: 'text-gray-600 bg-gray-50 border-gray-200',
    };
    return colors[phase as keyof typeof colors] || 'text-gray-600 bg-gray-50 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">Delete Goal</h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete{' '}
                  <span className="font-medium">"{deleteConfirmation.goalName}"</span>?
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={() => setDeleteConfirmation({ isOpen: false, goalId: null, goalName: '' })}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm lg:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm lg:text-base"
                >
                  Delete Goal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Confirmation Modal */}
      {completeConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">Mark Goal as Complete</h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600">
                  Congratulations! Are you ready to mark{' '}
                  <span className="font-medium">"{completeConfirmation.goalName}"</span>{' '}
                  as complete? This will deactivate the goal and move it to your history.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={() => setCompleteConfirmation({ isOpen: false, goalId: null, goalName: '' })}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm lg:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteConfirm}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm lg:text-base"
                >
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Goals</h1>
            <p className="mt-2 text-sm lg:text-base text-gray-600">Set and track goals for weight and body measurements.</p>
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

        {/* Fitness Phase Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 lg:p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900">Current Fitness Phase</h2>
              <button
                onClick={() => setEditingPhase(true)}
                className="flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Phase
              </button>
            </div>
          </div>
          <div className="p-4 lg:p-6">
            {editingPhase ? (
              <form onSubmit={handlePhaseSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Your Current Fitness Phase
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'cutting', name: 'Cutting', description: 'Focused on losing weight and reducing body fat', icon: TrendingDown },
                      { id: 'bulking', name: 'Bulking', description: 'Focused on gaining weight and building muscle', icon: TrendingUp },
                      { id: 'maintaining', name: 'Maintaining', description: 'Focused on maintaining current weight and body composition', icon: Minus },
                      { id: 'none', name: 'No Specific Phase', description: 'Just living life without a specific fitness focus', icon: User },
                    ].map((phase) => {
                      const Icon = phase.icon;
                      return (
                        <label
                          key={phase.id}
                          className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                            phaseData.fitness_phase === phase.id
                              ? getFitnessPhaseColor(phase.id)
                              : 'border-gray-300 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="fitness_phase"
                            value={phase.id}
                            checked={phaseData.fitness_phase === phase.id}
                            onChange={(e) => setPhaseData({ fitness_phase: e.target.value })}
                            className="sr-only"
                          />
                          <div className="flex items-center">
                            <Icon className="h-5 w-5 lg:h-6 lg:w-6 mr-3 lg:mr-4 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium">{phase.name}</div>
                              <div className="text-sm text-gray-500">{phase.description}</div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setEditingPhase(false)}
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
                    {saving ? 'Saving...' : 'Save Phase'}
                  </button>
                </div>
              </form>
            ) : (
              <div className={`p-4 rounded-lg border ${getFitnessPhaseColor(phaseData.fitness_phase)}`}>
                <div className="flex items-center">
                  {phaseData.fitness_phase === 'cutting' && <TrendingDown className="h-6 w-6 mr-3" />}
                  {phaseData.fitness_phase === 'bulking' && <TrendingUp className="h-6 w-6 mr-3" />}
                  {phaseData.fitness_phase === 'maintaining' && <Minus className="h-6 w-6 mr-3" />}
                  {phaseData.fitness_phase === 'none' && <User className="h-6 w-6 mr-3" />}
                  <div>
                    <h3 className="font-medium">{getFitnessPhaseLabel(phaseData.fitness_phase)}</h3>
                    <p className="text-sm opacity-75">{getFitnessPhaseDescription(phaseData.fitness_phase)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <div className="space-y-4">
            {activeGoals.map((goal) => {
              const progress = getGoalProgress(goal);
              const unit = getGoalUnit(goal);
              const Icon = goal.goal_category === 'weight' ? Scale : Ruler;

              return (
                <div key={goal.id} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 lg:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <Icon className="h-6 w-6 text-blue-600 mr-3" />
                      <div>
                        <h3 className="text-base lg:text-lg font-semibold text-gray-900">
                          {goal.goal_category === 'weight' ? 'Weight Goal' : `${goal.measurement_field?.field_name} Goal`}
                        </h3>
                        <p className="text-sm text-gray-600">Active Goal</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCompleteClick(goal)}
                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                        title="Mark as complete"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(goal)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Edit goal"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(goal)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete goal"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  {progress && (
                    <>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                          <span>{progress.startingValue} {unit}</span>
                          <span>{progress.targetValue} {unit}</span>
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
                          <p className="text-gray-600">Current</p>
                          <p className="font-semibold text-gray-900">{progress.currentValue} {unit}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Progress</p>
                          <div className="flex items-center">
                            {(() => {
                              const ProgressIcon = getProgressIcon(goal, progress.currentChange);
                              const progressColor = getProgressColor(goal, progress.currentChange);
                              return (
                                <>
                                  <ProgressIcon className={`h-4 w-4 mr-1 ${progressColor}`} />
                                  <p className={`font-semibold ${progressColor}`}>
                                    {progress.currentChange > 0 ? '+' : ''}{progress.currentChange.toFixed(1)} {unit}
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-600">Remaining</p>
                          <p className="font-semibold text-gray-900">
                            {Math.abs(progress.remaining).toFixed(1)} {unit}
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
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Goal Form */}
        {showForm && (
          <div ref={formRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900">
                {editingGoal ? 'Edit Goal' : 'Create New Goal'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Goal Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Goal Category
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                    formData.goal_category === 'weight'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="goal_category"
                      value="weight"
                      checked={formData.goal_category === 'weight'}
                      onChange={(e) => setFormData({ ...formData, goal_category: e.target.value, measurement_field_id: '' })}
                      className="sr-only"
                    />
                    <div className="flex items-center">
                      <Scale className="h-5 w-5 mr-3 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium">Weight Goal</div>
                        <div className="text-sm text-gray-500">Target weight changes</div>
                      </div>
                    </div>
                  </label>

                  <label className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                    formData.goal_category === 'measurement'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="goal_category"
                      value="measurement"
                      checked={formData.goal_category === 'measurement'}
                      onChange={(e) => setFormData({ ...formData, goal_category: e.target.value, target_weight: '' })}
                      className="sr-only"
                    />
                    <div className="flex items-center">
                      <Ruler className="h-5 w-5 mr-3 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium">Measurement Goal</div>
                        <div className="text-sm text-gray-500">Target body measurements</div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Measurement Field Selection (only for measurement goals) */}
              {formData.goal_category === 'measurement' && (
                <div>
                  <label htmlFor="measurement_field_id" className="block text-sm font-medium text-gray-700">
                    Measurement Field
                  </label>
                  <select
                    id="measurement_field_id"
                    required
                    value={formData.measurement_field_id}
                    onChange={(e) => setFormData({ ...formData, measurement_field_id: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                  >
                    <option value="">Select measurement field</option>
                    {measurementFields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.field_name} ({field.unit})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Value */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={formData.goal_category === 'weight' ? 'target_weight' : 'target_value'} className="block text-sm font-medium text-gray-700">
                    Target {formData.goal_category === 'weight' ? 'Weight (lbs)' : 'Value'}
                    {formData.goal_category === 'measurement' && formData.measurement_field_id && (
                      <span className="text-gray-500">
                        {' '}({measurementFields.find(f => f.id === formData.measurement_field_id)?.unit})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    id={formData.goal_category === 'weight' ? 'target_weight' : 'target_value'}
                    step="0.1"
                    required
                    value={formData.goal_category === 'weight' ? formData.target_weight : formData.target_value}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      [formData.goal_category === 'weight' ? 'target_weight' : 'target_value']: e.target.value 
                    })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                    placeholder={`Enter target ${formData.goal_category === 'weight' ? 'weight' : 'value'}`}
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
                  Weekly Goal (optional)
                </label>
                <input
                  type="number"
                  id="weekly_goal"
                  step="0.1"
                  value={formData.weekly_goal}
                  onChange={(e) => setFormData({ ...formData, weekly_goal: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                  placeholder={`Units per week (${formData.goal_category === 'weight' ? 'lbs' : 'measurement units'})`}
                />
              </div>

              {/* Current Value Info */}
              {(() => {
                let currentValue = null;
                let unit = '';
                let source = '';

                if (formData.goal_category === 'weight' && latestWeight) {
                  currentValue = latestWeight.weight;
                  unit = 'lbs';
                  source = formatDate(latestWeight.date).toLocaleDateString();
                } else if (formData.goal_category === 'measurement' && formData.measurement_field_id && latestMeasurements) {
                  const value = latestMeasurements.values?.find(v => v.field_id === formData.measurement_field_id);
                  if (value) {
                    currentValue = value.value;
                    unit = value.field?.unit || '';
                    source = formatDate(latestMeasurements.date).toLocaleDateString();
                  }
                }

                if (currentValue) {
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center">
                        {formData.goal_category === 'weight' ? (
                          <Scale className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
                        ) : (
                          <Ruler className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            Starting from current value: {currentValue} {unit}
                          </p>
                          <p className="text-xs text-blue-700">
                            Logged on {source}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

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
                  const unit = getGoalUnit(goal);
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
                            <h3 className="font-medium text-gray-900">
                              {goal.goal_category === 'weight' ? 'Weight' : goal.measurement_field?.field_name} Goal
                            </h3>
                            {goal.is_active && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Target:</span> {getTargetValue(goal)} {unit}
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
                                  {progress.currentChange > 0 ? '+' : ''}{progress.currentChange.toFixed(1)} {unit}
                                </span>
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Created:</span> {new Date(goal.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          {!goal.is_active && (
                            <button
                              onClick={() => handleSetActive(goal.id, goal.goal_category)}
                              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              Set Active
                            </button>
                          )}
                          {goal.is_active && (
                            <button
                              onClick={() => handleCompleteClick(goal)}
                              className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
                              title="Mark as complete"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(goal)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit goal"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(goal)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete goal"
                          >
                            <Trash2 className="h-4 w-4" />
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
    </>
  );
}