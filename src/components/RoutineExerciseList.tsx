import { useState, useRef } from "react";
import FormInput from "./ui/FormInput";
import { RoutineExercise } from "../types";
import { GripVertical, Trash2, Timer } from "lucide-react";

type RoutineExerciseListProps = {
  routineExercises: RoutineExercise[];
  setRoutineExercises: React.Dispatch<React.SetStateAction<RoutineExercise[]>>;
  updateExercise: (index: number, field: keyof RoutineExercise, value: any) => void;
};

export const RoutineExerciseList = ({
  routineExercises,
  setRoutineExercises,
  updateExercise,
}: RoutineExerciseListProps) => {
  const [dragIndex, setDragIndex] = useState<number|null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number|null>(null);
  const [dragYTop, setDragYTop] = useState<number|null>(null);
  const [dragYBottom, setDragYBottom] = useState<number|null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number|null>(null);
  const dragOverIndexRef = useRef<number|null>(null);
  const activeDragItemRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>, index: number) => {
    const exercise = e.currentTarget.closest(".routine-exercise");
    if(exercise){
      const listEl = listRef.current;
      if (!listEl) return;
  
      const exerciseRect = exercise.getBoundingClientRect();
      const listRect = listEl.getBoundingClientRect();
      dragIndexRef.current = index;
      const yPositionTop = exerciseRect.top-listRect.top;
      const yTop = exerciseRect.bottom > listRect.bottom ?
        null :
        (
          yPositionTop >= 0 ? yPositionTop : 0
        );
      const yBottom = exerciseRect.bottom >= listRect.bottom ? 0 : null;
      
      setDragIndex(index);
      setDragOverIndex(index);
      setDragYTop(index === routineExercises.length-1 ? null : yTop);
      setDragYBottom(index === routineExercises.length-1 ? 0 : yBottom);

      // Add global dragging cursor
      document.body.classList.add("dragging");

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
  };

  const SCROLL_EDGE = 10;
  const SCROLL_SPEED = 10;

  const handleMouseMove = (e: MouseEvent) => {
    if (dragIndexRef.current === null) return;

    const listEl = listRef.current;
    if (!listEl) return;
    const listRect = listEl.getBoundingClientRect();
    const listItems = listEl.children;

    const exerciseRect = listItems[dragIndexRef.current].getBoundingClientRect();
    const yPositionTop = e.clientY-listRect.top;
    const yTop = exerciseRect.bottom > listRect.bottom ?
      null :
      (
        yPositionTop >= 0 ? yPositionTop : 0
      );
    const yBottom = exerciseRect.bottom >= listRect.bottom ? 0 : null;

    setDragYTop(dragIndexRef.current === routineExercises.length-1 ? null : yTop);
    setDragYBottom(dragIndexRef.current === routineExercises.length-1 ? 0 : yBottom);

    if(window.innerHeight - exerciseRect.bottom < SCROLL_EDGE){
      window.scrollBy({ top: SCROLL_SPEED, behavior: 'auto'});
    }

    if(exerciseRect.top < SCROLL_EDGE){
      window.scrollBy({ top: -SCROLL_SPEED, behavior: 'auto'});
    }

    let newDragOverIndex = dragIndexRef.current;

    for (let i = 0; i < listItems.length; i++) {
      if (i === dragIndexRef.current) continue;
      const rect = listItems[i].getBoundingClientRect();
      const halfway = rect.top + rect.height / 2;

      // Swap when crossing midpoints
      if (dragIndexRef.current < i && e.clientY > halfway) {
        swapItems(dragIndexRef.current, i);
        dragIndexRef.current = i;
        setDragIndex(i);
        break;
      }
      if (dragIndexRef.current > i && e.clientY < halfway) {
        swapItems(dragIndexRef.current, i);
        dragIndexRef.current = i;
        setDragIndex(i);
        break;
      }
    }
  };

  const handleMouseUp = () => {
    dragIndexRef.current = null;
    setDragIndex(null);

    // Remove global dragging cursor
    document.body.classList.remove("dragging");

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const swapItems = (from: number, to: number) => {
    const updated = [...routineExercises];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setRoutineExercises(updated);
  };

  const removeExercise = (index: number) => {
    setRoutineExercises(routineExercises.filter((_, i) => i !== index));
  };

  // Helper functions for rest timer
  const getRestMinutes = (restSeconds: number | null | undefined): number => {
    if (!restSeconds) return 0;
    return Math.floor(restSeconds / 60);
  };

  const getRestSecondsRemainder = (restSeconds: number | null | undefined): number => {
    if (!restSeconds) return 0;
    return restSeconds % 60;
  };

  const updateRestTime = (index: number, minutes: number, seconds: number) => {
    const totalSeconds = minutes * 60 + seconds;
    updateExercise(index, 'rest_seconds', totalSeconds);
  };

  return (
    <div ref={listRef} className="space-y-4">
    {routineExercises.map((routineExercise, index) => {
      const isDragging = index === dragIndex;
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
      })}
    </div>
  );
}