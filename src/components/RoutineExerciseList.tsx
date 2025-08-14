import { useState, useRef } from "react";
import { RoutineExercise } from "../types";
import { RoutineExerciseItem } from "./RoutineExerciseItem";

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

    console.log(dragIndexRef.current);

    const listEl = listRef.current;
    if (!listEl) return;
    const listRect = listEl.getBoundingClientRect();
    const listItems = listEl.children;

    const exerciseRect = listItems[dragIndexRef.current].getBoundingClientRect();
    console.log(e.clientY, listRect.top);
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
        <RoutineExerciseItem
          key={routineExercise.id}
          activeDragItemRef={activeDragItemRef}
          dragYBottom={dragYBottom}
          dragYTop={dragYTop}
          getRestMinutes={getRestMinutes}
          getRestSecondsRemainder={getRestSecondsRemainder}
          handleMouseDown={handleMouseDown}
          index={index}
          isDragging={isDragging}
          removeExercise={removeExercise}
          routineExercise={routineExercise}
          updateExercise={updateExercise}
          updateRestTime={updateRestTime}
        />
      );
      })}
    </div>
  );
}
