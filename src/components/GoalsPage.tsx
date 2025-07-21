import React, { useState, useEffect, useRef } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, Save, Edit2, Plus, Scale, CheckCircle, AlertCircle, Ruler, X, Trash2, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/date';
import { scrollToElement } from '../lib/htmlElement';
import type { UserGoal, WeightEntry, MeasurementField, BodyMeasurement } from '../types';
import { useAuth } from '../contexts/AuthContext';
import FormInput from './ui/FormInput';

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

interface ConflictConfirmation {
  isOpen: boolean;
  conflictingGoal: UserGoal | null;
  newGoalData: any;
}

export default function GoalsPage() {
  const { user, authLoading } = useAuth();
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [activeGoals, setActiveGoals] = useState<UserGoal[]>([]);
  const [inactiveGoals, setInactiveGoals] = useState<UserGoal[]>([]);
  const [measurementFields, setMeasurementFields] = useState<MeasurementField[]>([]);
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null);
  const [latestMeasurements, setLatestMeasurements] = useState<BodyMeasurement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<UserGoal | null>(null);
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

  const [conflictConfirmation, setConflictConfirmation] = useState<ConflictConfirmation>({
    isOpen: false,
    conflictingGoal: null,
    newGoalData: null,
  });

  const [formData, setFormData] = useState({
    goal_category: 'weight',
    target_weight: '',
    target_value: '',
    measurement_field_id: '',
    target_date: '',
    weekly_goal: '',
  });

  const [fitnessPhase, setFitnessPhase] = useState<'cutting' | 'bulking' | 'maintaining' | 'none'>('none');
  const [updatingPhase, setUpdatingPhase] = useState(false);

  // Ref for timeout on fitness phase success messages
  const fitnessPhaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Ref for the form section to enable auto-scrolling
  const formRef = useRef<HTMLDivElement>(null);
  const editFormRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if(authLoading) return;
    if(!user) return;

    loadGoalsData();
  }, [authLoading, user]);

  useEffect(() => {
    const isFormRefPresent = !!formRef.current;
    scrollToElement(formRef, showForm && isFormRefPresent);
  }, [showForm]);

  useEffect(() => {
    const isEditFormRefPresent = !!editFormRef.current;
    scrollToElement(editFormRef, editingGoal !== null && isEditFormRefPresent);
  }, [editingGoal]);

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
      if (!user) return;

      // Load user profile for fitness phase
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;
      setFitnessPhase(profileData?.fitness_phase || 'none');

      // Load goals with measurement field info
      const { data: goalsData, error: goalsError } = await supabase
        .from('user_goals')
        .select(`
          *,
          measurement_field:measurement_fields(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      // Load measurement fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('measurement_fields')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('field_name');

      if (fieldsError) throw fieldsError;

      // Load latest weight
      const { data: weightData, error: weightError } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', user.id)
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
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1);

      if (measurementError) throw measurementError;

      const allGoals = goalsData || [];
      setGoals(allGoals);
      setActiveGoals(allGoals.filter(g => g.is_active));
      setInactiveGoals(allGoals.filter(g => !g.is_active));
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

  const updateFitnessPhase = async (newPhase: 'cutting' | 'bulking' | 'maintaining' | 'none') => {
    setUpdatingPhase(true);
    try {
      if (!user) return;

      const { error } = await supabase
        .from('user_profiles')
        .update({ fitness_phase: newPhase, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;

      setFitnessPhase(newPhase);
      setSuccess('Fitness phase updated successfully!');
      
      // Clear the old timeout if it exists
      if(fitnessPhaseTimeoutRef.current){
        clearTimeout(fitnessPhaseTimeoutRef.current);
      }
    
      // Set a new timeout
      fitnessPhaseTimeoutRef.current = setTimeout(() => {
        setSuccess('');
        fitnessPhaseTimeoutRef.current = null;
      }, 3000);
    } catch (error) {
      console.error('Error updating fitness phase:', error);
      setError('Failed to update fitness phase');
    } finally {
      setUpdatingPhase(false);
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

  const checkForConflictingGoal = (goalData: any): UserGoal | null => {
    return activeGoals.find(goal => {
      if (editingGoal && goal.id === editingGoal.id) return false; // Skip self when editing
      
      if (goalData.goal_category === 'weight') {
        return goal.goal_category === 'weight';
      } else {
        return goal.goal_category === 'measurement' && 
               goal.measurement_field_id === goalData.measurement_field_id;
      }
    }) || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!user) return;

      let goalData: any = {
        user_id: user.id,
        goal_category: formData.goal_category,
        target_date: formData.target_date || null,
        weekly_goal: formData.weekly_goal ? parseFloat(formData.weekly_goal) : null,
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
        // Update existing goal (don't change is_active status)
        const { error } = await supabase
          .from('user_goals')
          .update(goalData)
          .eq('id', editingGoal.id);

        if (error) throw error;
        setSuccess('Goal updated successfully!');
      } else {
        // Check for conflicting active goal
        const conflictingGoal = checkForConflictingGoal(goalData);
        
        if (conflictingGoal) {
          setConflictConfirmation({
            isOpen: true,
            conflictingGoal,
            newGoalData: { ...goalData, is_active: true },
          });
          setSaving(false);
          return;
        }

        // Create new goal as active
        goalData.is_active = true;
        const { error } = await supabase
          .from('user_goals')
          .insert([goalData]);

        if (error) throw error;
        setSuccess('New goal created successfully!');
      }

      setTimeout(() => setSuccess(''), 5000);
      resetForm();
      loadGoalsData();
    } catch (error: any) {
      console.error('Error saving goal:', error);
      setError(error.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  const handleConflictConfirm = async () => {
    if (!conflictConfirmation.newGoalData || !conflictConfirmation.conflictingGoal) return;

    try {
      // Deactivate conflicting goal
      await supabase
        .from('user_goals')
        .update({ is_active: false })
        .eq('id', conflictConfirmation.conflictingGoal.id);

      // Create new goal
      const { error } = await supabase
        .from('user_goals')
        .insert([conflictConfirmation.newGoalData]);

      if (error) throw error;

      setSuccess('New goal created and previous goal deactivated!');
      setTimeout(() => setSuccess(''), 5000);
      resetForm();
      loadGoalsData();
    } catch (error: any) {
      console.error('Error creating goal:', error);
      setError(error.message || 'Failed to create goal');
    } finally {
      setConflictConfirmation({ isOpen: false, conflictingGoal: null, newGoalData: null });
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
    setShowForm(false); // Hide the main form when editing inline
  };

  const handleSetActive = async (goalId: string, category: string) => {
    try {
      // Check for conflicting active goal
      const conflictingGoal = activeGoals.find(goal => {
        if (category === 'weight') {
          return goal.goal_category === 'weight';
        } else {
          const targetGoal = goals.find(g => g.id === goalId);
          return goal.goal_category === 'measurement' && 
                 goal.measurement_field_id === targetGoal?.measurement_field_id;
        }
      });

      if (conflictingGoal) {
        // Deactivate conflicting goal first
        await supabase
          .from('user_goals')
          .update({ is_active: false })
          .eq('id', conflictingGoal.id);
      }

      // Activate selected goal
      const { error } = await supabase
        .from('user_goals')
        .update({ is_active: true })
        .eq('id', goalId);

      if (error) throw error;
      
      setSuccess('Active goal updated!');
      setTimeout(() => setSuccess(''), 5000);
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
      setTimeout(() => setSuccess(''), 5000);
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
      setTimeout(() => setSuccess(''), 5000);
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
    if (change === 0) return 'text-gray-600 dark:text-gray-400';
    
    // For measurement goals, determine if increase/decrease is good based on the field
    let changeNeeded;
    if (goal.goal_category === 'measurement') {
      /* const fieldName = goal.measurement_field?.field_name?.toLowerCase() || '';
      
      // Generally, decreases are good for waist, body fat, etc.
      // Increases are good for chest, biceps, etc.
      const decreaseIsGood = fieldName.includes('waist') || 
                            fieldName.includes('body fat') || 
                            fieldName.includes('fat');
      
      if (decreaseIsGood) {
        return change < 0 ? 'text-green-600' : 'text-red-600';
      } else {
        return change > 0 ? 'text-green-600' : 'text-red-600';
      } */

      changeNeeded = (goal.target_value || 0) - (goal.starting_value || 0);
    }else{
      changeNeeded = (goal.target_weight || 0) - (goal.starting_weight || 0);
    }
    
    if(changeNeeded > 0){
      return change > 0 ? 'text-green-600' : 'text-red-600';
    }else{
      return change < 0 ? 'text-green-600' : 'text-red-600';
    }
    
    // For weight goals, use the fitness phase
    /* switch (fitnessPhase) {
      case 'cutting':
        return change < 0 ? 'text-green-600' : 'text-red-600';
      case 'bulking':
        return change > 0 ? 'text-green-600' : 'text-red-600';
      case 'maintaining':
        return Math.abs(change) <= 2 ? 'text-green-600' : 'text-orange-600';
      default:
        return 'text-gray-600 dark:text-gray-400';
    } */
  };

  const getProgressIcon = (change: number) => {
    if (change === 0) return Minus;
    return change > 0 ? TrendingUp : TrendingDown;
  };

  const getGoalUnit = (goal: UserGoal) => {
    if (goal.goal_category === 'weight') {
      return 'lbs';
    }
    return goal.measurement_field?.unit || '';
  };

  const fitnessPhases = [
    {
      id: 'cutting',
      name: 'Cutting',
      description: 'Losing weight while maintaining muscle',
      icon: TrendingDown,
      color: 'text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-400/40',
    },
    {
      id: 'bulking',
      name: 'Bulking',
      description: 'Gaining weight to build muscle',
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-200/10 border-green-200 dark:border-green-400/40',
    },
    {
      id: 'maintaining',
      name: 'Maintaining',
      description: 'Maintaining current weight/composition',
      icon: Minus,
      color: 'text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-600/50',
    },
    {
      id: 'none',
      name: 'None',
      description: 'Not following a specific phase',
      icon: Target,
      color: 'text-gray-600 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600',
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
    <>
      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Delete Goal</h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Are you sure you want to delete{' '}
                  <span className="font-medium">"{deleteConfirmation.goalName}"</span>?
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={() => setDeleteConfirmation({ isOpen: false, goalId: null, goalName: '' })}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm lg:text-base"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Mark Goal as Complete</h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Congratulations! Are you ready to mark{' '}
                  <span className="font-medium">"{completeConfirmation.goalName}"</span>{' '}
                  as complete? This will deactivate the goal and move it to your history.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={() => setCompleteConfirmation({ isOpen: false, goalId: null, goalName: '' })}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm lg:text-base"
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

      {/* Conflict Confirmation Modal */}
      {conflictConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 dark:text-white">Active Goal Conflict</h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  You already have an active goal for this {conflictConfirmation.newGoalData?.goal_category === 'weight' ? 'weight' : 'measurement'}:
                </p>
                {conflictConfirmation.conflictingGoal && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                    <p className="font-medium text-orange-900">
                      {conflictConfirmation.conflictingGoal.goal_category === 'weight' 
                        ? 'Weight Goal' 
                        : `${conflictConfirmation.conflictingGoal.measurement_field?.field_name} Goal`}
                    </p>
                    <p className="text-sm text-orange-700">
                      Target: {getTargetValue(conflictConfirmation.conflictingGoal)} {getGoalUnit(conflictConfirmation.conflictingGoal)}
                    </p>
                  </div>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Would you like to replace it with your new goal? The current goal will be moved to your history.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={() => setConflictConfirmation({ isOpen: false, conflictingGoal: null, newGoalData: null })}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm lg:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConflictConfirm}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm lg:text-base"
                >
                  Replace Goal
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
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">Goals</h1>
            <p className="mt-2 text-sm lg:text-base text-gray-600 dark:text-gray-400">Set and track goals for weight and body measurements.</p>
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
          <div className="bg-green-50 dark:bg-green-200/10 border border-green-200 dark:border-green-400/40 text-green-600 px-4 py-3 rounded-lg flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span className="text-sm lg:text-base">{success}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-400/40 text-red-600 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span className="text-sm lg:text-base">{error}</span>
          </div>
        )}

        {/* Fitness Phase Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white mb-4">Current Fitness Phase</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This affects how progress indicators are colored when you don't have specific goals set.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {fitnessPhases.map((phase) => {
              const Icon = phase.icon;
              return (
                <button
                  key={phase.id}
                  onClick={() => updateFitnessPhase(phase.id as any)}
                  disabled={updatingPhase}
                  className={`relative flex flex-col items-center p-4 border rounded-lg transition-colors disabled:opacity-50 ${
                    fitnessPhase === phase.id
                      ? phase.color
                      : 'border-gray-300 dark:border-gray-600 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'
                  }`}
                >
                  <Icon className="h-6 w-6 mb-2" />
                  <div className="text-sm font-medium">{phase.name}</div>
                  <div className="text-xs text-center mt-1 opacity-75">{phase.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Add Goal Form */}
        {showForm && (
          <div ref={formRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white">Create New Goal</h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-400 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Goal Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                  Goal Category
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                    formData.goal_category === 'weight'
                      ? 'border-blue-500 dark:border-blue-200 bg-blue-50 dark:bg-blue-600/10'
                      : 'border-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'
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
                      <Scale className="h-5 w-5 mr-3 dark:text-gray-200 flex-shrink-0" />
                      <div>
                        <div className="text-sm dark:text-gray-100 font-medium">Weight Goal</div>
                        <div className="text-sm text-gray-500 dark:text-gray-300">Target weight changes</div>
                      </div>
                    </div>
                  </label>

                  <label className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                    formData.goal_category === 'measurement'
                      ? 'border-blue-500 dark:border-blue-200 bg-blue-50 dark:bg-blue-600/10'
                      : 'border-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'
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
                        <div className="text-sm dark:text-gray-100 font-medium">Measurement Goal</div>
                        <div className="text-sm dark:text-gray-300 text-gray-500">Target body measurements</div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Measurement Field Selection (only for measurement goals) */}
              {formData.goal_category === 'measurement' && (
                <div>
                  <label htmlFor="measurement_field_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Measurement Field
                  </label>
                  <FormInput
                    inputType="select"
                    id="measurement_field_id"
                    required
                    value={formData.measurement_field_id}
                    onChange={(e) => setFormData({ ...formData, measurement_field_id: e.target.value })}
                  >
                    <>
                      <option value="">Select measurement field</option>
                      {measurementFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.field_name} ({field.unit})
                        </option>
                      ))}
                    </>
                  </FormInput>
                </div>
              )}

              {/* Target Value */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={formData.goal_category === 'weight' ? 'target_weight' : 'target_value'} className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Target {formData.goal_category === 'weight' ? 'Weight (lbs)' : 'Value'}
                    {formData.goal_category === 'measurement' && formData.measurement_field_id && (
                      <span className="text-gray-500">
                        {' '}({measurementFields.find(f => f.id === formData.measurement_field_id)?.unit})
                      </span>
                    )}
                  </label>
                  <FormInput
                    type="number"
                    id={formData.goal_category === 'weight' ? 'target_weight' : 'target_value'}
                    step="0.1"
                    required
                    value={formData.goal_category === 'weight' ? formData.target_weight : formData.target_value}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      [formData.goal_category === 'weight' ? 'target_weight' : 'target_value']: e.target.value 
                    })}
                    placeholder={`Enter target ${formData.goal_category === 'weight' ? 'weight' : 'value'}`}
                  />
                </div>

                <div>
                  <label htmlFor="target_date" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Target Date (optional)
                  </label>
                  <FormInput
                    type="date"
                    id="target_date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="weekly_goal" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Weekly Goal (optional)
                </label>
                <FormInput
                  type="number"
                  id="weekly_goal"
                  step="0.1"
                  value={formData.weekly_goal}
                  onChange={(e) => setFormData({ ...formData, weekly_goal: e.target.value })}
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
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center">
                        {formData.goal_category === 'weight' ? (
                          <Scale className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                        ) : (
                          <Ruler className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            Starting from current value: {currentValue} {unit}
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Logged on {source}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-600">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm lg:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Creating...' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white">Active Goals</h2>
            {activeGoals.map((goal) => {
              const progress = getGoalProgress(goal);
              const unit = getGoalUnit(goal);
              const Icon = goal.goal_category === 'weight' ? Scale : Ruler;

              // Check if this goal is being edited
              if (editingGoal?.id === goal.id) {
                return (
                  <div ref={editFormRef} key={goal.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-4 lg:p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white">Edit Goal</h3>
                      <button
                        onClick={() => setEditingGoal(null)}
                        className="text-gray-400 hover:text-gray-600 dark:text-gray-400 p-1"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Goal Category Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                          Goal Category
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                            formData.goal_category === 'weight'
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'
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
                              : 'border-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'
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
                          <label htmlFor="measurement_field_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Measurement Field
                          </label>
                          <FormInput
                            inputType="select"
                            id="measurement_field_id"
                            required
                            value={formData.measurement_field_id}
                            onChange={(e) => setFormData({ ...formData, measurement_field_id: e.target.value })}
                          >
                            <>
                              <option value="">Select measurement field</option>
                              {measurementFields.map((field) => (
                                <option key={field.id} value={field.id}>
                                  {field.field_name} ({field.unit})
                                </option>
                              ))}
                            </>
                          </FormInput>
                        </div>
                      )}

                      {/* Target Value */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={formData.goal_category === 'weight' ? 'target_weight' : 'target_value'} className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Target {formData.goal_category === 'weight' ? 'Weight (lbs)' : 'Value'}
                            {formData.goal_category === 'measurement' && formData.measurement_field_id && (
                              <span className="text-gray-500">
                                {' '}({measurementFields.find(f => f.id === formData.measurement_field_id)?.unit})
                              </span>
                            )}
                          </label>
                          <FormInput
                            type="number"
                            id={formData.goal_category === 'weight' ? 'target_weight' : 'target_value'}
                            step="0.1"
                            required
                            value={formData.goal_category === 'weight' ? formData.target_weight : formData.target_value}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              [formData.goal_category === 'weight' ? 'target_weight' : 'target_value']: e.target.value 
                            })}
                            placeholder={`Enter target ${formData.goal_category === 'weight' ? 'weight' : 'value'}`}
                          />
                        </div>

                        <div>
                          <label htmlFor="target_date" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Target Date (optional)
                          </label>
                          <FormInput
                            type="date"
                            id="target_date"
                            value={formData.target_date}
                            onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="weekly_goal" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                          Weekly Goal (optional)
                        </label>
                        <FormInput
                          type="number"
                          id="weekly_goal"
                          step="0.1"
                          value={formData.weekly_goal}
                          onChange={(e) => setFormData({ ...formData, weekly_goal: e.target.value })}
                          placeholder={`Units per week (${formData.goal_category === 'weight' ? 'lbs' : 'measurement units'})`}
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-600">
                        <button
                          type="button"
                          onClick={() => setEditingGoal(null)}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm lg:text-base"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {saving ? 'Updating...' : 'Update Goal'}
                        </button>
                      </div>
                    </form>
                  </div>
                );
              }

              return (
                <div key={goal.id} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 lg:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
                      <div>
                        <h3 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-white">
                          {goal.goal_category === 'weight' ? 'Weight Goal' : `${goal.measurement_field?.field_name} Goal`}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Active Goal</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCompleteClick(goal)}
                        className="p-2 text-green-600 hover:bg-green-100 dark:bg-green-400/20 rounded-lg transition-colors"
                        title="Mark as complete"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(goal)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-lg transition-colors"
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
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
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
                          <p className="text-gray-600 dark:text-gray-400">Current</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 dark:text-white">{progress.currentValue} {unit}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Progress</p>
                          <div className="flex items-center">
                            {(() => {
                              const ProgressIcon = getProgressIcon(progress.currentChange);
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
                          <p className="text-gray-600 dark:text-gray-400">Remaining</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 dark:text-white">
                            {Math.abs(progress.remaining).toFixed(1)} {unit}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Completion</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 dark:text-white">
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

        {/* Goals History */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
          <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-600">
            <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">Goals History</h2>
          </div>
          <div className="p-4 lg:p-6">
            {inactiveGoals.length > 0 ? (
              <div className="space-y-4">
                {inactiveGoals.map((goal) => {
                  const progress = getGoalProgress(goal);
                  const unit = getGoalUnit(goal);
                  const ProgressIcon = progress ? getProgressIcon(progress.currentChange) : Minus;
                  const progressColor = progress ? getProgressColor(goal, progress.currentChange) : 'text-gray-600 dark:text-gray-400';

                  // Check if this goal is being edited
                  if (editingGoal?.id === goal.id) {
                    return (
                      <div ref={editFormRef} key={goal.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-4 lg:p-6">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Goal</h3>
                          <button
                            onClick={() => setEditingGoal(null)}
                            className="text-gray-400 hover:text-gray-600 dark:text-gray-400 p-1"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                          {/* Goal Category Selection */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                              Goal Category
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              <label className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                                formData.goal_category === 'weight'
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'
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
                                  : 'border-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'
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
                              <label htmlFor="measurement_field_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Measurement Field
                              </label>
                              <FormInput
                                inputType="select"
                                id="measurement_field_id"
                                required
                                value={formData.measurement_field_id}
                                onChange={(e) => setFormData({ ...formData, measurement_field_id: e.target.value })}
                              >
                                <>
                                  <option value="">Select measurement field</option>
                                  {measurementFields.map((field) => (
                                    <option key={field.id} value={field.id}>
                                      {field.field_name} ({field.unit})
                                    </option>
                                  ))}
                                </>
                              </FormInput>
                            </div>
                          )}

                          {/* Target Value */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor={formData.goal_category === 'weight' ? 'target_weight' : 'target_value'} className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Target {formData.goal_category === 'weight' ? 'Weight (lbs)' : 'Value'}
                                {formData.goal_category === 'measurement' && formData.measurement_field_id && (
                                  <span className="text-gray-500">
                                    {' '}({measurementFields.find(f => f.id === formData.measurement_field_id)?.unit})
                                  </span>
                                )}
                              </label>
                              <FormInput
                                type="number"
                                id={formData.goal_category === 'weight' ? 'target_weight' : 'target_value'}
                                step="0.1"
                                required
                                value={formData.goal_category === 'weight' ? formData.target_weight : formData.target_value}
                                onChange={(e) => setFormData({ 
                                  ...formData, 
                                  [formData.goal_category === 'weight' ? 'target_weight' : 'target_value']: e.target.value 
                                })}
                                placeholder={`Enter target ${formData.goal_category === 'weight' ? 'weight' : 'value'}`}
                              />
                            </div>

                            <div>
                              <label htmlFor="target_date" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Target Date (optional)
                              </label>
                              <FormInput
                                type="date"
                                id="target_date"
                                value={formData.target_date}
                                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                                min={new Date().toISOString().split('T')[0]}
                              />
                            </div>
                          </div>

                          <div>
                            <label htmlFor="weekly_goal" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                              Weekly Goal (optional)
                            </label>
                            <FormInput
                              type="number"
                              id="weekly_goal"
                              step="0.1"
                              value={formData.weekly_goal}
                              onChange={(e) => setFormData({ ...formData, weekly_goal: e.target.value })}
                              placeholder={`Units per week (${formData.goal_category === 'weight' ? 'lbs' : 'measurement units'})`}
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-600">
                            <button
                              type="button"
                              onClick={() => setEditingGoal(null)}
                              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm lg:text-base"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={saving}
                              className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              {saving ? 'Updating...' : 'Update Goal'}
                            </button>
                          </div>
                        </form>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={goal.id}
                      className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100">
                              {goal.goal_category === 'weight' ? 'Weight' : goal.measurement_field?.field_name} Goal
                            </h3>
                          </div>
                          
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
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
                          <button
                            onClick={() => handleSetActive(goal.id, goal.goal_category)}
                            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Set Active
                          </button>
                          <button
                            onClick={() => handleEdit(goal)}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:text-blue-400 transition-colors"
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
                <p className="text-gray-500 mb-2 text-sm lg:text-base">No goals in history yet</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 text-sm font-medium"
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