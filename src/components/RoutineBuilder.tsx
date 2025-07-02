import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Save, X, Search, Dumbbell, Edit2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { WorkoutRoutine, Exercise, RoutineExercise } from '../types';
import { useCustomExercises } from '../hooks/useCustomExercises';
import { CustomExerciseForm } from '../components/CustomExerciseForm';

export default function RoutineBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [routine, setRoutine] = useState<WorkoutRoutine | null>(null);
  const [routineExercises, setRoutineExercises] = useState<RoutineExercise[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const addExercise = (exercise: Exercise) => {
    const nonWeightMuscleGroups = ['Cardio', 'Core', 'Full Body']
    const skipWeightReps = nonWeightMuscleGroups.includes(exercise.muscle_group);
    const newRoutineExercise: RoutineExercise = {
      id: `temp-${Date.now()}`,
      routine_id: id || '',
      exercise_id: exercise.id,
      order_index: routineExercises.length,
      target_sets: 3,
      require_weight: skipWeightReps,
      require_reps: skipWeightReps,
      created_at: new Date().toISOString(),
      exercise,
    };

    setRoutineExercises([...routineExercises, newRoutineExercise]);
    setShowExerciseSelector(false);
    setSearchTerm('');
  };

  const {
    muscleGroups,
    customExerciseData,
    setCustomExerciseData,
    editingExercise,
    setEditingExercise,
    showCustomExerciseForm,
    createCustomExercise,
    updateCustomExercise,
    deleteCustomExercise,
    handleEditExercise,
    resetCustomExerciseForm,
    setShowCustomExerciseForm,
  } = useCustomExercises(setAvailableExercises, addExercise);
 

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      // Load available exercises (both global and user's custom exercises)
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .select('*')
        .order('name');

      if (exercisesError) throw exercisesError;
      setAvailableExercises(exercisesData || []);

      if (isEditing) {
        // Load existing routine
        const { data: routineData, error: routineError } = await supabase
          .from('workout_routines')
          .select('*')
          .eq('id', id)
          .single();

        if (routineError) throw routineError;
        setRoutine(routineData);
        setFormData({
          name: routineData.name,
          description: routineData.description || '',
        });

        // Load routine exercises
        const { data: routineExercisesData, error: routineExercisesError } = await supabase
          .from('routine_exercises')
          .select(`
            *,
            exercise:exercises(*)
          `)
          .eq('routine_id', id)
          .order('order_index');

        if (routineExercisesError) throw routineExercisesError;
        setRoutineExercises(routineExercisesData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      let routineId = id;

      if (isEditing) {
        // Update existing routine
        const { error } = await supabase
          .from('workout_routines')
          .update({
            name: formData.name,
            description: formData.description || null,
          })
          .eq('id', id);

        if (error) throw error;
      } else {
        // Create new routine
        const { data, error } = await supabase
          .from('workout_routines')
          .insert([{
            user_id: user.data.user.id,
            name: formData.name,
            description: formData.description || null,
          }])
          .select()
          .single();

        if (error) throw error;
        routineId = data.id;
      }

      // Save routine exercises
      if (routineExercises.length > 0) {
        // Delete existing routine exercises if editing
        if (isEditing) {
          await supabase
            .from('routine_exercises')
            .delete()
            .eq('routine_id', routineId);
        }

        // Insert new routine exercises
        const exercisesToInsert = routineExercises.map((re, index) => ({
          routine_id: routineId,
          exercise_id: re.exercise_id,
          order_index: index,
          target_sets: re.target_sets,
          target_reps: re.target_reps,
          target_weight: re.target_weight,
          rest_seconds: re.rest_seconds,
          notes: re.notes,
        }));

        const { error } = await supabase
          .from('routine_exercises')
          .insert(exercisesToInsert);

        if (error) throw error;
      }

      navigate('/workouts');
    } catch (error) {
      console.error('Error saving routine:', error);
    } finally {
      setSaving(false);
    }
  };

  const removeExercise = (index: number) => {
    setRoutineExercises(routineExercises.filter((_, i) => i !== index));
  };

  const updateExercise = (index: number, field: keyof RoutineExercise, value: any) => {
    const updated = [...routineExercises];
    updated[index] = { ...updated[index], [field]: value };
    setRoutineExercises(updated);
  };

  const filteredExercises = availableExercises.filter(exercise =>
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exercise.muscle_group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      {/* Exercise Selector Modal */}
      {showExerciseSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add Exercise</h3>
                <button
                  onClick={() => setShowExerciseSelector(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search exercises..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => {
                    setEditingExercise(null);
                    setShowCustomExerciseForm(true);
                  }}
                  className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Custom Exercise
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {filteredExercises.map((exercise) => (
                  <div key={exercise.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => addExercise(exercise)}>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{exercise.name}</p>
                        {exercise.is_custom && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{exercise.muscle_group}</p>
                      {exercise.equipment && (
                        <p className="text-xs text-gray-500">{exercise.equipment}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {exercise.is_custom && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditExercise(exercise);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCustomExercise(exercise.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => addExercise(exercise)}
                        className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredExercises.length === 0 && (
                  <div className="text-center py-8">
                    <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">No exercises found</p>
                    <p className="text-sm text-gray-400">Try adjusting your search or create a custom exercise</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Exercise Form Modal */}
      {showCustomExerciseForm && (
        <>
          {/* Custom Exerise edit/add form */}
          <CustomExerciseForm
            customExerciseData={customExerciseData}
            setCustomExerciseData={setCustomExerciseData}
            editingExercise={editingExercise}
            showCustomExerciseForm={showCustomExerciseForm}
            createCustomExercise={createCustomExercise}
            updateCustomExercise={updateCustomExercise}
            resetCustomExerciseForm={resetCustomExerciseForm}
            muscleGroups={muscleGroups}
          />
        </>
      )}
      <div className="space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {isEditing ? 'Edit Routine' : 'Create New Routine'}
            </h1>
            <p className="mt-2 text-sm lg:text-base text-gray-600">
              {isEditing ? 'Modify your workout routine' : 'Build a custom workout routine with exercises and sets'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/workouts')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm lg:text-base"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Routine'}
            </button>
          </div>
        </div>
  
        {/* Routine Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-4">Routine Details</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Routine Name
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                placeholder="e.g., Push Day, Leg Day, Upper Body"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <input
                type="text"
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
                placeholder="Brief description of this routine"
              />
            </div>
          </div>
        </div>
  
        {/* Exercises */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 lg:p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900">Exercises</h2>
              <button
                onClick={() => setShowExerciseSelector(true)}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Exercise
              </button>
            </div>
          </div>
          
          <div className="p-4 lg:p-6">
            {routineExercises.length > 0 ? (
              <div className="space-y-4">
                {routineExercises.map((routineExercise, index) => (
                  <div key={routineExercise.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center">
                        <GripVertical className="h-5 w-5 text-gray-400" />
                        <span className="ml-2 text-sm font-medium text-gray-500">#{index + 1}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900">{routineExercise.exercise?.name}</h3>
                              {routineExercise.exercise?.is_custom && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Custom
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{routineExercise.exercise?.muscle_group}</p>
                            {routineExercise.exercise?.equipment && (
                              <p className="text-xs text-gray-500">{routineExercise.exercise.equipment}</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeExercise(index)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Sets</label>
                            <input
                              type="number"
                              min="1"
                              value={routineExercise.target_sets}
                              onChange={(e) => updateExercise(index, 'target_sets', parseInt(e.target.value))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Reps</label>
                            <input
                              type="number"
                              min="1"
                              value={routineExercise.target_reps || ''}
                              onChange={(e) => updateExercise(index, 'target_reps', e.target.value ? parseInt(e.target.value) : null)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="10"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Weight (lbs)</label>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={routineExercise.target_weight || ''}
                              onChange={(e) => updateExercise(index, 'target_weight', e.target.value ? parseFloat(e.target.value) : null)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="135"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Rest (sec)</label>
                            <input
                              type="number"
                              min="0"
                              step="15"
                              value={routineExercise.rest_seconds || ''}
                              onChange={(e) => updateExercise(index, 'rest_seconds', e.target.value ? parseInt(e.target.value) : null)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="60"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                          <input
                            type="text"
                            value={routineExercise.notes || ''}
                            onChange={(e) => updateExercise(index, 'notes', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Form cues, variations, etc."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Plus className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No exercises added yet</p>
                <button
                  onClick={() => setShowExerciseSelector(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Add your first exercise
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}