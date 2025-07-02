import { useState } from 'react';
import { supabase } from '../lib/supabase.ts'; // adjust as needed

export const useCustomExercises = (
  setExercises: React.Dispatch<React.SetStateAction<Exercise[]>>,
  addExercise?: (exercise: Exercise) => void // optional
) => {
  const muscleGroups = [
    'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core', 'Cardio', 'Full Body', 'Other'
  ];
  const [customExerciseData, setCustomExerciseData] = useState({
    name: '',
    muscle_group: '',
    equipment: '',
    instructions: '',
  });

  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [showCustomExerciseForm, setShowCustomExerciseForm] = useState(false);

  const resetCustomExerciseForm = () => {
    setCustomExerciseData({ name: '', muscle_group: '', equipment: '', instructions: '' });
    setEditingExercise(null);
    setShowCustomExerciseForm(false);
  };

  const createCustomExercise = async () => {
    if (!customExerciseData.name.trim() || !customExerciseData.muscle_group.trim()) return;

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const { data, error } = await supabase
        .from('exercises')
        .insert([{
          user_id: user.data.user.id,
          name: customExerciseData.name,
          muscle_group: customExerciseData.muscle_group,
          equipment: customExerciseData.equipment || null,
          instructions: customExerciseData.instructions || null,
          is_custom: true,
        }])
        .select()
        .single();

      if (error) throw error;

      setExercises(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));

      // Optionally call the external callback
      if(addExercise){
        addExercise(data);
      }
      
      resetCustomExerciseForm();
    } catch (error) {
      console.error('Error creating custom exercise:', error);
    }
  };

  const updateCustomExercise = async () => {
    if (!editingExercise || !customExerciseData.name.trim() || !customExerciseData.muscle_group.trim()) return;

    try {
      const { data, error } = await supabase
        .from('exercises')
        .update({
          name: customExerciseData.name,
          muscle_group: customExerciseData.muscle_group,
          equipment: customExerciseData.equipment || null,
          instructions: customExerciseData.instructions || null,
        })
        .eq('id', editingExercise.id)
        .select()
        .single();

      if (error) throw error;

      setExercises(prev =>
        prev.map(ex => ex.id === editingExercise.id ? data : ex)
            .sort((a, b) => a.name.localeCompare(b.name))
      );

      resetCustomExerciseForm();
    } catch (error) {
      console.error('Error updating custom exercise:', error);
    }
  };

  const deleteCustomExercise = async (exerciseId: string) => {
    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', exerciseId);

      if (error) throw error;

      setExercises(prev => prev.filter(ex => ex.id !== exerciseId));
    } catch (error) {
      console.error('Error deleting custom exercise:', error);
    }
  };

  const handleEditExercise = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setCustomExerciseData({
      name: exercise.name,
      muscle_group: exercise.muscle_group,
      equipment: exercise.equipment || '',
      instructions: exercise.instructions || '',
    });
    setShowCustomExerciseForm(true);
  };

  return {
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
  };
};
