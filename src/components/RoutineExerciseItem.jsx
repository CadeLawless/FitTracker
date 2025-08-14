import React from "react";
import FormInput from "./ui/FormInput";
import { GripVertical, Trash2, Timer } from "lucide-react";
import { RoutineExercise } from "../types";

interface RoutineExerciseItemProps {
    isDragging: boolean;
    activeDragItemRef: React.Ref<HTMLDivElement>;
    dragYTop: number|null;
    dragYBottom: number|null;
    handleMouseDown: (e: React.MouseEvent<SVGSVGElement>, index: number) => void;
    index: number;
    routineExercise: RoutineExercise;
    removeExercise: (index: number) => void;
    updateExercise: (index: number, field: keyof RoutineExercise, value: any) => void;
    updateRestTime: (index: number, minutes: number, seconds: number) => void;
    getRestMinutes: (restSeconds: number | null | undefined) => number;
    getRestSecondsRemainder: (restSeconds: number | null | undefined) => number;
}

export const RoutineExerciseItem = ({
    isDragging,
    activeDragItemRef,
    dragYTop,
    dragYBottom,
    handleMouseDown,
    index,
    routineExercise,
    removeExercise,
    updateExercise,
    updateRestTime,
    getRestMinutes,
    getRestSecondsRemainder
}: RoutineExerciseItemProps) => {


    return (
        <div 
          key={routineExercise.id} 
          ref={isDragging ? activeDragItemRef : null}
          className={`routine-exercise w-full border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-lg p-4 transition-shadow
            ${isDragging ? `absolute cursor-grabbing shadow-lg z-50` : "relative"}`}
          style={{
            top: isDragging ? dragYTop || undefined : undefined,
            bottom: isDragging ? dragYBottom || undefined : undefined,
          }}
        >
          <div className="flex items-start gap-4">
            <div className="flex items-center">
              <GripVertical
                className={`h-5 w-5 text-gray-400 hover:text-gray-600 dark:text-gray-400 transition-colors ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={(e) => handleMouseDown(e, index)}
              />
              <span className="ml-2 text-sm font-medium text-gray-500">#{index + 1}</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{routineExercise.exercise?.name}</h3>
                    {routineExercise.exercise?.is_custom && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-400/20 text-green-800 dark:text-green-200">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{routineExercise.exercise?.muscle_group}</p>
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

              {/* Skip Weight/Reps Checkboxes */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={!routineExercise.requires_weight}
                      onChange={(e) => updateExercise(index, 'requires_weight', !e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-200">Skip Weight</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={!routineExercise.requires_reps}
                      onChange={(e) => updateExercise(index, 'requires_reps', !e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-200">Skip Reps</span>
                  </label>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Sets</label>
                  <FormInput
                    inputMode="numeric"
                    type="number"
                    min="1"
                    value={routineExercise.target_sets}
                    onChange={(e) => updateExercise(index, 'target_sets', parseInt(e.target.value))}
                  />
                </div>
                {routineExercise.requires_reps && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Reps</label>
                    <FormInput
                      inputMode="numeric"
                      type="number"
                      min="1"
                      value={routineExercise.target_reps || ''}
                      onChange={(e) => updateExercise(index, 'target_reps', e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="10"
                    />
                  </div>
                )}
                {routineExercise.requires_weight && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Weight (lbs)</label>
                    <FormInput
                      type="number"
                      step="0.5"
                      min="0"
                      value={routineExercise.target_weight || ''}
                      onChange={(e) => updateExercise(index, 'target_weight', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="135"
                    />
                  </div>
                )}
              </div>

              {/* Rest Timer - Minutes and Seconds */}
              <div className="mt-3">
                <label className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">
                  <Timer className="h-3 w-3" />
                  Rest Time
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <FormInput
                      inputMode="numeric"
                      type="number"
                      min="0"
                      max="59"
                      value={getRestMinutes(routineExercise.rest_seconds) === 0 ? '' : getRestMinutes(routineExercise.rest_seconds)}
                      onChange={(e) => updateRestTime(
                        index, 
                        parseInt(e.target.value) || 0, 
                        getRestSecondsRemainder(routineExercise.rest_seconds)
                      )}
                      className="w-16 px-2 py-1"
                      placeholder="2"
                    />
                    <span className="text-xs text-gray-500">min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FormInput
                      inputMode="numeric"
                      type="number"
                      min="0"
                      max="59"
                      value={getRestSecondsRemainder(routineExercise.rest_seconds) === 0 ? '' : getRestSecondsRemainder(routineExercise.rest_seconds)}
                      onChange={(e) => updateRestTime(
                        index, 
                        getRestMinutes(routineExercise.rest_seconds), 
                        parseInt(e.target.value) || 0
                      )}
                      className="w-16 px-2 py-1"
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-500">sec</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Notes (optional)</label>
                <FormInput
                  type="text"
                  value={routineExercise.notes || ''}
                  onChange={(e) => updateExercise(index, 'notes', e.target.value)}
                  placeholder="Form cues, variations, etc."
                />
              </div>
            </div>
          </div>
        </div>
    );
}
