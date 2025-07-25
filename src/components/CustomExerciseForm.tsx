import { Plus, Edit2, X } from 'lucide-react';
import FormInput from './ui/FormInput';

export const CustomExerciseForm = ({
  customExerciseData,
  setCustomExerciseData,
  editingExercise,
  showCustomExerciseForm,
  createCustomExercise,
  updateCustomExercise,
  resetCustomExerciseForm,
  muscleGroups,
}: {
  customExerciseData: any;
  setCustomExerciseData: any;
  editingExercise: any;
  showCustomExerciseForm: boolean;
  createCustomExercise: () => void;
  updateCustomExercise: () => void;
  resetCustomExerciseForm: () => void;
  muscleGroups: string[];
}) => {
  if (!showCustomExerciseForm) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-h-[90dvh] overflow-y-auto max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {editingExercise ? 'Edit Custom Exercise' : 'Create Custom Exercise'}
            </h3>
            <button onClick={resetCustomExerciseForm} className="text-gray-400 hover:text-gray-600 dark:text-gray-400">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Exercise Name *</label>
              <FormInput
                type="text"
                required
                value={customExerciseData.name}
                onChange={(e) =>
                  setCustomExerciseData({ ...customExerciseData, name: e.target.value })
                }
                placeholder="e.g., Bulgarian Split Squats"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Muscle Group *</label>
              <FormInput
                inputType='select'
                required
                value={customExerciseData.muscle_group}
                onChange={(e) =>
                  setCustomExerciseData({ ...customExerciseData, muscle_group: e.target.value })
                }
              >
                <>
                  <option value="">Select muscle group</option>
                  {muscleGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </>
              </FormInput>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Equipment</label>
              <FormInput
                type="text"
                value={customExerciseData.equipment}
                onChange={(e) =>
                  setCustomExerciseData({ ...customExerciseData, equipment: e.target.value })
                }
                placeholder="e.g., Dumbbells, Barbell, Bodyweight"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Instructions</label>
              <FormInput
                inputType='textarea'
                rows={3}
                value={customExerciseData.instructions}
                onChange={(e) =>
                  setCustomExerciseData({ ...customExerciseData, instructions: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={resetCustomExerciseForm}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={editingExercise ? updateCustomExercise : createCustomExercise}
              disabled={!customExerciseData.name.trim() || !customExerciseData.muscle_group.trim()}
              className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {editingExercise ? <Edit2 className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {editingExercise ? 'Update Exercise' : 'Create Exercise'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};