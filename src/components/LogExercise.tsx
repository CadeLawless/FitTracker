import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Calendar, Clock, FileText, Dumbbell } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Exercise } from '../types';
import { useAuth } from '../contexts/AuthContext';
import FormInput from './ui/FormInput';

export default function LogExercise() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const exerciseId = searchParams.get('exercise');

  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    exercise_id: exerciseId || '',
    date: new Date().toISOString().split('T')[0],
    duration_minutes: '',
    notes: '',
  });

  useEffect(() => {
    if(authLoading) return;
    if(!user) return;

    loadExercises();
  }, [authLoading, user]);

  useEffect(() => {
    if (exerciseId && allExercises.length > 0) {
      setFormData(prev => ({ ...prev, exercise_id: exerciseId }));
    }
  }, [exerciseId, allExercises]);

  const loadExercises = async () => {
    try {
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .select('*')
        .order('name');

      if (exercisesError) throw exercisesError;
      setAllExercises(exercisesData || []);
    } catch (error) {
      console.error('Error loading exercises:', error);
      setError('Failed to load exercises');
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
      if (!user) throw new Error('No authenticated user');

      const selectedExercise = allExercises.find(ex => ex.id === formData.exercise_id);
      if (!selectedExercise) throw new Error('Please select an exercise');

      // Create workout session for this single exercise
      const { data: sessionData, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert([{
          user_id: user.id,
          name: `${selectedExercise.name} - Single Exercise`,
          date: formData.date,
          duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
          notes: formData.notes || null,
          status: 'completed',
          completed_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Create a single exercise set entry
      const { error: setError } = await supabase
        .from('exercise_sets')
        .insert([{
          workout_session_id: sessionData.id,
          exercise_id: formData.exercise_id,
          set_number: 1,
          duration_seconds: formData.duration_minutes ? parseInt(formData.duration_minutes) * 60 : null,
        }]);

      if (setError) throw setError;

      setSuccess('Exercise logged successfully!');
      
      // Reset form
      setFormData({
        exercise_id: '',
        date: new Date().toISOString().split('T')[0],
        duration_minutes: '',
        notes: '',
      });

      // Navigate to workout session details after a short delay
      setTimeout(() => {
        navigate(`/workouts/session/${sessionData.id}`);
      }, 1500);

    } catch (error: any) {
      console.error('Error logging exercise:', error);
      setError(error.message || 'Failed to log exercise');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const selectedExercise = allExercises.find(ex => ex.id === formData.exercise_id);

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
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/workouts?activeTab=log_exercise')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">Log Exercise</h1>
          <p className="mt-2 text-sm lg:text-base text-gray-600 dark:text-gray-400">
            Quickly log a single exercise without creating a full routine.
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-200/10 border border-green-200 dark:border-green-400/40 text-green-600 px-4 py-3 rounded-lg flex items-center">
          <Dumbbell className="h-5 w-5 mr-2 flex-shrink-0" />
          <span className="text-sm lg:text-base">{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-400/40 text-red-600 px-4 py-3 rounded-lg text-sm lg:text-base">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Exercise Selection */}
          <div>
            <label htmlFor="exercise_id" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Exercise *
            </label>
            <FormInput
              inputType="select"
              id="exercise_id"
              name="exercise_id"
              required
              value={formData.exercise_id}
              onChange={handleInputChange}
            >
              <option value="">Select an exercise</option>
              {allExercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name} - {exercise.muscle_group}
                  {exercise.is_custom ? ' (Custom)' : ''}
                </option>
              ))}
            </FormInput>
            {selectedExercise && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-blue-900 dark:text-blue-100">{selectedExercise.name}</h3>
                  {selectedExercise.is_custom && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-400/20 text-green-800 dark:text-green-200">
                      Custom
                    </span>
                  )}
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">{selectedExercise.muscle_group}</p>
                {selectedExercise.equipment && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">{selectedExercise.equipment}</p>
                )}
                {selectedExercise.instructions && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{selectedExercise.instructions}</p>
                )}
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <Calendar className="h-4 w-4 inline mr-1" />
              Date *
            </label>
            <FormInput
              type="date"
              id="date"
              name="date"
              required
              value={formData.date}
              onChange={handleInputChange}
            />
          </div>

          {/* Duration */}
          <div>
            <label htmlFor="duration_minutes" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <Clock className="h-4 w-4 inline mr-1" />
              Duration (minutes)
            </label>
            <FormInput
              inputMode="numeric"
              type="number"
              id="duration_minutes"
              name="duration_minutes"
              min="1"
              step="1"
              value={formData.duration_minutes}
              onChange={handleInputChange}
              placeholder="e.g., 30"
            />
            <p className="mt-1 text-xs text-gray-500">
              Optional: How long did this exercise take to complete?
            </p>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <FileText className="h-4 w-4 inline mr-1" />
              Notes / Description
            </label>
            <FormInput
              inputType="textarea"
              id="notes"
              name="notes"
              rows={4}
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="e.g., I ran for 3 miles, I did 3 sets at 100 lbs, felt great today..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Optional: Add any details about your exercise session
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={() => navigate('/workouts')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm lg:text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.exercise_id || !formData.date}
              className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Logging...' : 'Log Exercise'}
            </button>
          </div>
        </form>
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Quick Tips</h3>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• This creates a single-exercise workout session</li>
          <li>• Perfect for cardio, stretching, or standalone exercises</li>
          <li>• Use the notes field to track sets, reps, distance, or any other details</li>
          <li>• Duration is optional but helpful for tracking time-based exercises</li>
        </ul>
      </div>
    </div>
  );
}