import React, { useRef, useState, useEffect } from 'react';
import { Check, Timer, Edit2, Save, X, ArrowLeft, ArrowRight, Dumbbell, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { scrollToRef } from '../lib/htmlElement';
import type { WorkoutRoutine, RoutineExercise, ExerciseSet, WorkoutSession as WorkoutSessionType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import FormInput from './ui/FormInput';
import { formatMinutes } from '../lib/formatMinutes';
import { insertHTMLLineBreaks } from '../lib/insertHTMLLineBreaks';

interface WorkoutState {
  session: WorkoutSessionType | null;
  currentExerciseIndex: number;
  currentSet: number;
  sets: ExerciseSet[];
  isResting: boolean;
  restTimeRemaining: number;
  sessionStartTime: Date;
}

interface PopupConfirmation {
  isOpen: boolean;
  type: 'complete' | 'cancel';
}

export default function WorkoutSession() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routineId = searchParams.get('routine');
  const resumeSessionId = searchParams.get('resume');

  const [routine, setRoutine] = useState<WorkoutRoutine | null>(null);
  const [routineExercises, setRoutineExercises] = useState<RoutineExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [workoutState, setWorkoutState] = useState<WorkoutState>({
    session: null,
    currentExerciseIndex: 0,
    currentSet: 1,
    sets: [],
    isResting: false,
    restTimeRemaining: 0,
    sessionStartTime: new Date(),
  });

  const [editingSet, setEditingSet] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ 
    weight: '', 
    reps: '', 
    durationMinutes: '' 
  });


  const [restTimer, setRestTimer] = useState<NodeJS.Timeout | null>(null);
  const [customRestMinutes, setCustomRestMinutes] = useState<number>(2);
  const [customRestSeconds, setCustomRestSeconds] = useState<number>(0);
  const [showCustomTimer, setShowCustomTimer] = useState(false);
  const [popupConfirmation, setPopupConfirmation] = useState<PopupConfirmation>({
    isOpen: false,
    type: 'complete'
  });

  const hasCreatedSessionRef = useRef(false);
  const [workoutComplete, setWorkoutComplete] = useState(false);

  const restTimerDiv = useRef<HTMLDivElement>(null);
  const hasScrolledToRestTimer = useRef(false);

  useEffect(() => {
    const isRestTimerDivRefPresent = !!restTimerDiv.current;
    const ishasScrolledRefPresent = !!hasScrolledToRestTimer.current;
    const condition = workoutState.isResting && isRestTimerDivRefPresent && !ishasScrolledRefPresent;
    scrollToRef(restTimerDiv, condition);
    if (condition) {      
      hasScrolledToRestTimer.current = true;
    }
  }, [workoutState]);
  
  useEffect(() => {
    if(authLoading) return;
    if(!user) return;

    //console.log('WorkoutSession mounted');
    //console.log(workoutComplete);
    if (hasCreatedSessionRef.current || workoutComplete) {
      //console.log('Session creation already handled, skipping.');
      return;
    }
    hasCreatedSessionRef.current = true;
    if (resumeSessionId) {
      //console.log('Resuming session ID:', resumeSessionId);
      resumeExistingSession();
    } else if (routineId) {
      //console.log('Routine ID found:', routineId, '-> loading routine and creating session');
      loadRoutineAndCreateSession();
    } else {
      //console.log('No routineId or resumeSessionId -> starting custom workout');
      startCustomWorkout();
    }
  }, [routineId, resumeSessionId, authLoading, user]);

  useEffect(() => {
    return () => {
      if (restTimer) {
        clearInterval(restTimer);
      }
    };
  }, [restTimer]);

  const resumeExistingSession = async () => {
    try {
      if (!user) return;

      // Load existing session
      const { data: sessionData, error: sessionError } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          routine:workout_routines(*)
        `)
        .eq('id', resumeSessionId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (sessionError) {
        console.error('Session not found or not active:', sessionError);
        navigate('/workouts');
        return;
      }

     const sessionStart = new Date(sessionData.created_at);
      setRoutine(sessionData.routine);

      // Load routine exercises (needed for calculating currentExerciseIndex)
      const { data: routineExercises, error: exError } = await supabase
        .from('routine_exercises')
        .select(`
          *,
          exercise:exercises(*)
        `)
        .eq('routine_id', sessionData.routine_id)
        .order('order_index');
  
      if (exError) throw exError;
      setRoutineExercises(routineExercises || []);
  
      // Load sets and get return value
      const sets = await loadExistingSets(sessionData.id);
  
      const unfinishedIndex = findNextUnfinishedExerciseIndex(sets, routineExercises);
      const currentExercise = routineExercises[unfinishedIndex];
  
      const setsForCurrentExercise = sets.filter(
        s => s.exercise_id === currentExercise.exercise_id
      );
  
      const currentSet = setsForCurrentExercise.length > 0
        ? Math.max(...setsForCurrentExercise.map(s => s.set_number)) + 1
        : 1;
  
      setWorkoutState(prev => ({
        ...prev,
        session: sessionData,
        sessionStartTime: sessionStart,
        sets,
        currentExerciseIndex: unfinishedIndex,
        currentSet,
      }));
    } catch (error) {
      console.error('Error resuming session:', error);
      navigate('/workouts');
    } finally {
      setLoading(false);
    }
  };

  const loadRoutineAndCreateSession = async () => {
    const justCancelled = sessionStorage.getItem('justCancelled');
    if (justCancelled === 'true') {
      sessionStorage.removeItem('justCancelled');
      return;
    }
    try {
      // Load routine
      const { data: routineData, error: routineError } = await supabase
        .from('workout_routines')
        .select('*')
        .eq('id', routineId)
        .single();

      if (routineError) throw routineError;
      setRoutine(routineData);

      await loadRoutineExercises(routineId);
      await createWorkoutSession(routineData.name, routineId);
    } catch (error) {
      console.error('Error loading routine:', error);
      navigate('/workouts');
    } finally {
      setLoading(false);
    }
  };

  const loadRoutineExercises = async (routineId: string | null) => {
    const { data: exercisesData, error: exercisesError } = await supabase
      .from('routine_exercises')
      .select(`
        *,
        exercise:exercises(*)
      `)
      .eq('routine_id', routineId)
      .order('order_index');

    if (exercisesError) throw exercisesError;
    setRoutineExercises(exercisesData || []);
  };

  const loadExistingSets = async (sessionId: string) => {
    const { data: setsData, error: setsError } = await supabase
      .from('exercise_sets')
      .select('*')
      .eq('workout_session_id', sessionId)
      .order('exercise_id, set_number');

    if (setsError) throw setsError;
    
    const sets = setsData || [];
    setWorkoutState(prev => ({
      ...prev,
      sets,
      currentSet: 1,
    }));
    return sets;
  };

  const findNextUnfinishedExerciseIndex = (sets: any[], routineExercises: RoutineExercise[]) => {
    const exerciseIdToSetCounts: Record<string, number> = {};
  
    // Count how many sets have been completed per exercise
    for(const set of sets){
      if(!exerciseIdToSetCounts[set.exercise_id]){
        exerciseIdToSetCounts[set.exercise_id] = 0;
      }
      exerciseIdToSetCounts[set.exercise_id]++;
    }
  
    // Loop through routine exercises in order
    for(let i = 0; i < routineExercises.length; i++){
      const routineExercise = routineExercises[i];
      const expectedSets = routineExercise.target_sets || 3; // default to 3 if undefined
      const completedSets = exerciseIdToSetCounts[routineExercise.exercise_id] || 0;
  
      if(completedSets < expectedSets){
        return i;
      }
    }
  
    // All exercises completed? Start from end
    return routineExercises.length;
  };

  const startCustomWorkout = async () => {
    try {
      await createWorkoutSession('Custom Workout');
    } catch (error) {
      console.error('Error starting custom workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocalDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const createWorkoutSession = async (name: string, routineId?: string | null) => {
    console.log('Checking for existing active session');
    try {
      if (!user) return;

      // Check if there's already an active session for today
      const { data: existingSession, error: checkError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .eq('date', getLocalDateString())
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingSession) {
         console.log('Existing session found:', existingSession.id);
        // Resume existing session
        setWorkoutState(prev => ({
          ...prev,
          session: existingSession,
          sessionStartTime: new Date(existingSession.created_at),
        }));
        await loadExistingSets(existingSession.id);
        return;
      }else{
        console.log('No existing session, inserting new one');
      }

      // Create new session
      const { data, error } = await supabase
        .from('workout_sessions')
        .insert([{
          user_id: user.id,
          routine_id: routineId || null,
          name,
          date: getLocalDateString(),
          status: 'active',
        }])
        .select()
        .single();

      if (error) throw error;

      setWorkoutState(prev => ({
        ...prev,
        session: data,
        sessionStartTime: new Date(),
      }));
    } catch (error) {
      console.error('Error creating workout session:', error);
    }
  };

  const logSet = async (weight?: number, reps?: number, durationMinutes?: number) => {
    if (!workoutState.session) return;

    const currentExercise = routineExercises[workoutState.currentExerciseIndex];
    if (!currentExercise) return;

    try {
      const setData: any = {
        workout_session_id: workoutState.session.id,
        exercise_id: currentExercise.exercise_id,
        set_number: workoutState.currentSet,
        order_index: workoutState.currentExerciseIndex,
      };

      // Only include weight if required
      if (currentExercise.requires_weight && weight !== undefined) {
        setData.weight = weight;
      }

      // Only include reps if required
      if (currentExercise.requires_reps && reps !== undefined) {
        setData.reps = reps;
      }

      // Include duration if provided (for cardio/time-based exercises)
      if (durationMinutes !== undefined) {
        setData.duration_seconds = durationMinutes * 60;
      }

      const { data, error } = await supabase
        .from('exercise_sets')
        .insert([setData])
        .select()
        .single();

      if (error) throw error;

      const updatedSets = [...workoutState.sets, data];
      const newCurrentSet = workoutState.currentSet + 1;
      
      setWorkoutState(prev => ({
        ...prev,
        sets: updatedSets,
        currentSet: newCurrentSet,
      }));

      // Check if all exercises are done
      const isComplete = routineExercises.every(ex => {
        const setsLogged = updatedSets.filter(s => s.exercise_id === ex.exercise_id).length;
        return setsLogged >= ex.target_sets;
      });
  
      if (isComplete) {
        finishWorkout();
      } else {
        if(newCurrentSet > currentExercise.target_sets && workoutState.currentExerciseIndex < routineExercises.length - 1){
          nextExercise();
        }
        
        hasScrolledToRestTimer.current = false;
        const restTime = currentExercise.rest_seconds || null;
        if(restTime !== null){
          startRestTimer(restTime);
        }
      }
    } catch (error) {
      console.error('Error logging set:', error);
    }
  };

  const handleEditSet = (set: ExerciseSet) => {
    setEditingSet(set.id);
    setEditFormData({
      weight: set.weight?.toString() || '',
      reps: set.reps?.toString() || '',
      durationMinutes: set.duration_seconds ? (set.duration_seconds / 60).toString() : '',
    });
  };

  const handleSaveSet = async (setId: string) => {
    try {
      const updateData: any = {};
      
      if (editFormData.weight) {
        updateData.weight = parseFloat(editFormData.weight);
      }
      
      if (editFormData.reps) {
        updateData.reps = parseInt(editFormData.reps);
      }
      
      if (editFormData.durationMinutes) {
        updateData.duration_seconds = parseFloat(editFormData.durationMinutes) * 60;
      } else {
        updateData.duration_seconds = null;
      }

      const { error } = await supabase
        .from('exercise_sets')
        .update(updateData)
        .eq('id', setId);

      if (error) throw error;

      setEditingSet(null);

      setWorkoutState(prev => ({
        ...prev,
        sets: workoutState.sets.map(ex => ex.id === editingSet ? {
          ...ex,
          weight: updateData.weight,
          reps: updateData.reps,
          duration_seconds: updateData.duration_seconds,
        } : ex)
      }));
    } catch (error) {
      console.error('Error updating set:', error);
    }
  };

  const startRestTimer = (seconds: number) => {
    setWorkoutState(prev => ({
      ...prev,
      isResting: true,
      restTimeRemaining: seconds,
    }));

    const timer = setInterval(() => {
      setWorkoutState(prev => {
        if (prev.restTimeRemaining <= 1) {
          clearInterval(timer);
          return {
            ...prev,
            isResting: false,
            restTimeRemaining: 0,
          };
        }
        return {
          ...prev,
          restTimeRemaining: prev.restTimeRemaining - 1,
        };
      });
    }, 1000);

    setRestTimer(timer);
  };

  const startCustomRestTimer = () => {
    const totalSeconds = customRestMinutes * 60 + customRestSeconds;
    startRestTimer(totalSeconds);
    setShowCustomTimer(false);
    hasScrolledToRestTimer.current = false;
    scrollToRef(restTimerDiv, true);
  };

  const skipRest = () => {
    if (restTimer) {
      clearInterval(restTimer);
      setRestTimer(null);
    }
    setWorkoutState(prev => ({
      ...prev,
      isResting: false,
      restTimeRemaining: 0,
    }));
  };

  const handlePopupClick = (type: 'complete' | 'cancel') => {
    setPopupConfirmation({
      isOpen: true,
      type
    });
  };

  const handlePopupConfirm = async () => {
    if (popupConfirmation.type === 'complete'){
      finishWorkout();
    } else {
      cancelWorkout();
    }
  };

  const handlePopupCancel = () => {
    setPopupConfirmation({ isOpen: false, type: 'complete' });
  };
  
  const previousExercise = () => {
    setWorkoutState(prev => {
      const newIndex = prev.currentExerciseIndex - 1;
      const prevExercise = routineExercises[newIndex];
  
      // Find how many sets exist for the previous exercise
      const prevExerciseSets = prev.sets.filter(
        set => set.exercise_id === prevExercise.exercise_id
      );
  
      const nextSetNumber = prevExerciseSets.length + 1;
  
      return {
        ...prev,
        currentExerciseIndex: newIndex,
        currentSet: nextSetNumber,
      };
    });
  };
  
  const nextExercise = () => {
    setWorkoutState(prev => {
      const newIndex = prev.currentExerciseIndex + 1;
      const nextExercise = routineExercises[newIndex];
  
      const existingSets = prev.sets.filter(
        set => set.exercise_id === nextExercise.exercise_id
      );
  
      const nextSetNumber = existingSets.length + 1;
  
      return {
        ...prev,
        currentExerciseIndex: newIndex,
        currentSet: nextSetNumber,
      };
    });
  };

  const finishWorkout = async () => {
    if (!workoutState.session) return;

    try {
      const duration = Math.round((new Date().getTime() - workoutState.sessionStartTime.getTime()) / 60000);
      
      const { error } = await supabase
        .from('workout_sessions')
        .update({ 
          duration_minutes: duration,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', workoutState.session.id);

      if (error) throw error;

      setWorkoutComplete(true);
    } catch (error) {
      console.error('Error finishing workout:', error);
    }
  };

  const cancelWorkout = async () => {
    if (!workoutState.session) return;
console.log('Cancel workout clicked for session:', workoutState.session?.id);
    try {
      sessionStorage.setItem('justCancelled', 'true');
      const duration = Math.round((new Date().getTime() - workoutState.sessionStartTime.getTime()) / 60000);
      
      const { error } = await supabase
        .from('workout_sessions')
        .update({ 
          duration_minutes: duration,
          status: 'cancelled',
        })
        .eq('id', workoutState.session.id);

      if (error) throw error;

      navigate('/workouts', { replace: true });
    } catch (error) {
      console.error('Error cancelling workout:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentExercise = routineExercises[workoutState.currentExerciseIndex];

  const getUnfinishedExercises = (): RoutineExercise[] => {
    const setCounts: Record<string, number> = {};
  
    // Count logged sets per exercise
    workoutState.sets.forEach(set => {
      setCounts[set.exercise_id] = (setCounts[set.exercise_id] || 0) + 1;
    });
  
    // Return exercises that haven't met target sets
    return routineExercises.filter(exercise => {
      const completed = setCounts[exercise.exercise_id] || 0;
      return completed < exercise.target_sets;
    });
  };

  const unfinishedExercises = getUnfinishedExercises();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (workoutComplete) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="bg-green-50 dark:bg-green-200/10 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
          <Check className="h-12 w-12 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Workout Complete!</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Great job! You've completed {routine?.name || 'your workout'}.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/workouts')}
            className="px-6 py-3 border border-gray-300 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
          >
            Back to Workouts
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Popup Confirmation Modal */}
      {popupConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  {popupConfirmation.type === 'complete' ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  )}
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {popupConfirmation.type === 'complete' ? (
                      <span>Finish Workout</span>
                    ) : (
                      <span>Cancel Workout</span>
                    )}
                  </h3>
                </div>
              </div>
              <div className="mb-6">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Are you sure you want to {popupConfirmation.type === 'complete' ? 'finish' : 'cancel'} this workout?
                  {popupConfirmation.type === 'complete' && unfinishedExercises.length > 0 && (
                    <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-400/20 border-l-4 border-yellow-200 rounded">
                      <p className="font-bold text-yellow-900 dark:text-yellow-100">Sets still need finished for the following exercises:</p>
                      <ul className="list-disc list-inside text-yellow-800 dark:text-yellow-200">
                        {unfinishedExercises.map(ex => (
                          <li key={ex.exercise_id}>{ex.exercise?.name} ({(workoutState.sets.filter(s => s.exercise_id === ex.exercise_id).length)} of {ex.target_sets} sets)</li>
                        ))}
                      </ul>
                    </div>                    
                  )}
                  {popupConfirmation.type === 'cancel' && (
                    <p className="mt-2 text-sm">Your progress will be saved but the session will be marked as cancelled.</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={handlePopupCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm lg:text-base"
                >
                  {popupConfirmation.type === 'complete' ? 'Cancel' : 'Continue Workout'}
                </button>
                <button
                  onClick={handlePopupConfirm}
                  className={`px-4 py-2 bg-${popupConfirmation.type === 'complete' ? 'green' : 'red'}-600 text-white rounded-lg hover:bg-${popupConfirmation.type === 'complete' ? 'green' : 'red'}-700 transition-colors text-sm lg:text-base`}
                >
                  {popupConfirmation.type === 'complete' ? 'Finish Workout' : 'Cancel Workout'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {routine?.name || 'Custom Workout'}
                </h1>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-400/20 text-green-800 dark:text-green-200">
                  Active Session
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Exercise {workoutState.currentExerciseIndex + 1} of {routineExercises.length}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatMinutes(Math.round((new Date().getTime() - workoutState.sessionStartTime.getTime()) / 60000))}
              </p>
            </div>
          </div>
        </div>
  
        {/* Rest Timer */}
        {workoutState.isResting && (
          <div ref={restTimerDiv} className="bg-orange-50 dark:bg-orange-400/20 border border-orange-200 rounded-lg p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Timer className="h-6 w-6 text-orange-600 dark:text-orange-300 mr-3" />
                <div>
                  <h3 className="font-medium text-orange-900 dark:text-orange-200">Rest Time</h3>
                  <p className="text-sm text-orange-700 dark:text-orange-400">Take a break between sets</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-200">
                  {formatTime(workoutState.restTimeRemaining)}
                </p>
                <button
                  onClick={skipRest}
                  className="text-sm text-orange-600 dark:text-orange-300 hover:text-orange-700"
                >
                  Skip Rest
                </button>
              </div>
            </div>
          </div>
        )}
  
        {/* Current Exercise */}
        {currentExercise && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {currentExercise.exercise?.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{currentExercise.exercise?.muscle_group}</p>
              {currentExercise.exercise?.instructions && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{insertHTMLLineBreaks(currentExercise.exercise.instructions)}</p>
              )}
              {currentExercise.notes && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">Routine Notes: {currentExercise.notes}</p>
              )}
            </div>
  
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Set Logging */}
              <div>
                {workoutState.currentSet <= currentExercise.target_sets ? (
                  <>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                      Set {workoutState.currentSet} of {currentExercise.target_sets}
                    </h3>
                    
                    <SetLogger
                      targetWeight={currentExercise.target_weight}
                      targetReps={currentExercise.target_reps}
                      requiresWeight={currentExercise.requires_weight}
                      requiresReps={currentExercise.requires_reps}
                      onLogSet={logSet}
                      disabled={workoutState.isResting}
                    />
                  </>
                ) : (
                   <div className="flex flex-col items-center justify-center space-y-2 text-green-600 h-full">
                    <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2 font-bold text-lg">You crushed it!</p>
                    <p className="text-gray-500 mb-2 text-sm">All sets completed for this exercise</p>
                   </div>
                )}
              </div>
  
              {/* Previous Sets */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Previous Sets</h3>
                <div className="space-y-2">
                  {workoutState.sets
                    .filter(set => set.exercise_id === currentExercise.exercise_id)
                    .map((set) => (
                      <div key={set.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Set {set.set_number}</span>
                        <span className="flex items-center gap-2 text-sm dark:text-gray-100 font-medium">
                          <span>
                            {editingSet === set.id ? (
                              <div className="flex flex-grow sm:flex-grow-0 flex-col sm:flex-row sm:items-center gap-2 flex-wrap p-2">
                                  {/* Weight Input */}
                                  {currentExercise.requires_weight && (
                                    <div className="flex items-center gap-1">
                                      <FormInput
                                        type="number"
                                        step="0.5"
                                        value={editFormData.weight}
                                        onChange={(e) => setEditFormData({ ...editFormData, weight: e.target.value })}
                                        className="basis-[100px] px-1 py-1 text-xs large:text-xs"
                                        placeholder="Weight"
                                      />
                                      <span className="text-xs basis-[40px] text-gray-500">lbs</span>
                                    </div>
                                  )}
                                  
                                  {/* Reps Input */}
                                  {currentExercise.requires_reps && (
                                    <div className="flex items-center gap-1">
                                      <FormInput
                                        inputMode="numeric"
                                        type="number"
                                        value={editFormData.reps}
                                        onChange={(e) => setEditFormData({ ...editFormData, reps: e.target.value })}
                                        className="basis-[100px] px-1 py-1 text-xs large:text-xs"
                                        placeholder="Reps"
                                      />
                                      <span className="text-xs basis-[40px] text-gray-500">reps</span>
                                    </div>
                                  )}
                                
                                {/* Duration Input */}
                                {!currentExercise.requires_weight && (
                                  <div className="flex items-center gap-1">
                                    <FormInput
                                      type="number"
                                      step="0.5"
                                      value={editFormData.durationMinutes}
                                      onChange={(e) => setEditFormData({ ...editFormData, durationMinutes: e.target.value })}
                                      className="basis-[100px] px-1 py-1 text-xs large:text-xs"
                                      placeholder="Min"
                                    />
                                    <span className="text-xs basis-[40px] text-gray-500">min</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                  {set.weight && `${set.weight}lbs`}
                                  {set.weight && set.reps && ' × '}
                                  {set.reps && `${set.reps} reps`}
                                  {set.duration_seconds && `${Math.round(set.duration_seconds / 60)}min`}
                                  {!set.weight && !set.reps && !set.duration_seconds && 'Completed'}
                              </>
                            )}
                          </span>
                          {editingSet === set.id ? (
                            <>
                              <button
                                onClick={() => handleSaveSet(set.id)}
                                className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-600/20 rounded transition-colors"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingSet(null)}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/40 rounded transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditSet(set)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded transition-colors"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
  
            {/* Exercise Actions */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <div className="flex flex-col sm:flex-row gap-3">
                {!showCustomTimer ? (
                  <button
                    onClick={() => setShowCustomTimer(true)}
                    className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <Timer className="h-4 w-4 mr-2" />
                    Custom Rest Timer
                  </button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <FormInput
                        inputMode="numeric"
                        type="number"
                        value={customRestMinutes}
                        onChange={(e) => setCustomRestMinutes(parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        min="0"
                        max="59"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FormInput
                        inputMode="numeric"
                        type="number"
                        value={customRestSeconds}
                        onChange={(e) => setCustomRestSeconds(parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        min="0"
                        max="59"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">sec</span>
                    </div>
                    <button
                      onClick={startCustomRestTimer}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => setShowCustomTimer(false)}
                      className="px-3 py-1 border border-gray-300 text-gray-700 dark:text-gray-200 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-900/50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
  
                {workoutState.currentExerciseIndex > 0 && (
                  <button
                    onClick={previousExercise}
                    className="flex items-center justify-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous
                  </button>
                )}
                
                {workoutState.currentExerciseIndex < routineExercises.length - 1 && (
                  <button
                    onClick={nextExercise}
                    className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
  
        {/* Workout Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button
              onClick={() => handlePopupClick('cancel')}
              className="px-4 py-2 border border-red-300 dark:border-red-200/70 text-red-700 dark:text-red-200 rounded-lg hover:bg-red-800/10 transition-colors"
            >
              Cancel Workout
            </button>
            <button
              onClick={() => handlePopupClick('complete')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Finish Workout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface SetLoggerProps {
  targetWeight?: number | null;
  targetReps?: number | null;
  requiresWeight?: boolean;
  requiresReps?: boolean;
  onLogSet: (weight?: number, reps?: number, durationMinutes?: number) => void;
  disabled: boolean;
}

function SetLogger({ targetWeight, targetReps, requiresWeight = true, requiresReps = true, onLogSet, disabled }: SetLoggerProps) {
  const [weight, setWeight] = useState(targetWeight?.toString() || '');
  const [reps, setReps] = useState(targetReps?.toString() || '');
  const [durationMinutes, setDurationMinutes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (requiresWeight && !weight) return;
    if (requiresReps && !reps) return;
    
    onLogSet(
      requiresWeight && weight ? parseFloat(weight) : undefined,
      requiresReps && reps ? parseInt(reps) : undefined,
      !requiresReps && durationMinutes ? parseFloat(durationMinutes) : undefined
    );
    
    // Keep the same weight for next set, reset reps to target
    if (requiresReps) {
      setReps(targetReps?.toString() || '');
    } else {
      setDurationMinutes('');
    }
  };

  const isFormValid = () => {
    if (requiresWeight && !weight) return false;
    if (requiresReps && !reps) return false;
    if (!requiresReps && !requiresWeight) return true; // Bodyweight exercises
    return true;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {requiresWeight && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Weight (lbs)
            </label>
            <FormInput
              type="number"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="135"
              required
            />
          </div>
        )}
        
        {requiresReps ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Reps
            </label>
            <FormInput
              inputMode="numeric"
              type="number"
              min="1"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="10"
              required
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              <Clock className="h-4 w-4 inline mr-1" />
              Duration (minutes)
            </label>
            <FormInput
              type="number"
              step="0.5"
              min="0"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="30"
            />
          </div>
        )}
      </div>
      
      <button
        type="submit"
        disabled={disabled || !isFormValid()}
        className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Check className="h-4 w-4 mr-2" />
        Log Set
      </button>
    </form>
  );
}