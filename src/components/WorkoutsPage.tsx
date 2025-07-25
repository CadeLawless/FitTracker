import { useState, useEffect, useRef } from 'react';
import { Plus, Dumbbell, Clock, Calendar, Play, Edit2, Trash2, X, AlertTriangle, ChevronRight, RotateCcw, Square, Search } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/date';
import type { WorkoutSession, WorkoutRoutine, Exercise } from '../types';
import { useCustomExercises } from '../hooks/useCustomExercises';
import { CustomExerciseForm } from '../components/CustomExerciseForm';
import { useAuth } from '../contexts/AuthContext';
import FormInput from './ui/FormInput';
import { formatMinutes } from '../lib/formatMinutes';
import { getSessionStatusBadge } from '../lib/getSessionStatusBadge';

interface DeleteConfirmation {
  isOpen: boolean;
  type: 'session' | 'routine' | 'custom_exercise';
  id: string | null;
  name: string;
  date?: string;
}

type TabKey = 'sessions' | 'routines' | 'log_exercise' | 'custom_exercises';

export default function WorkoutsPage() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [showStartWorkout, setShowStartWorkout] = useState(false);
  const [startWorkoutTab, setStartWorkoutTab] = useState<'routines' | 'exercises'>('routines');
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState('');
  const [customExerciseSearchTerm, setCustomExerciseSearchTerm] = useState('');

  const addExercise = (exercise: Exercise) => {
    setAllExercises(prev => [...prev, exercise].sort((a, b) => a.name.localeCompare(b.name)));
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
    handleEditExercise,
    resetCustomExerciseForm,
    setShowCustomExerciseForm,
  } = useCustomExercises(setCustomExercises, addExercise);

  const [loading, setLoading] = useState(true);

  const allowedTabs: TabKey[] = ['sessions', 'routines', 'log_exercise', 'custom_exercises'];
  const param = searchParams.get('activeTab');
  const initialTab: TabKey = allowedTabs.includes(param as TabKey) ? (param as TabKey) : 'sessions';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>({
    isOpen: false,
    type: 'session',
    id: null,
    name: '',
  });

  const tabsContainerRef = useRef<HTMLDivElement|null>(null);
  const sessionsTabRef = useRef<HTMLButtonElement | null>(null);
  const routinesTabRef = useRef<HTMLButtonElement | null>(null);
  const logExerciseTabRef = useRef<HTMLButtonElement | null>(null);
  const customExercisesTabRef = useRef<HTMLButtonElement | null>(null);
      
  useEffect(() => {
    let tabElement;
    if(activeTab == 'sessions') tabElement = sessionsTabRef.current;
    if(activeTab == 'routines') tabElement = routinesTabRef.current;
    if(activeTab == 'log_exercise') tabElement = logExerciseTabRef.current;
    if(activeTab == 'custom_exercises') tabElement = customExercisesTabRef.current;
    
    if (tabElement && tabsContainerRef.current) {
      tabElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeTab, loading]);

  useEffect(() => {
    if(authLoading) return;
    if(!user) return;

    loadData();
  }, [authLoading, user]);

  const loadData = async () => {
    try {
      if (!user) return;

      // Load workout sessions with routine info, ordered by status and date
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          routine:workout_routines(name)
        `)
        .eq('user_id', user.id)
        .order('status', { ascending: true }) // active first
        .order('date', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Load workout routines
      const { data: routinesData, error: routinesError } = await supabase
        .from('workout_routines')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (routinesError) throw routinesError;

      // Load custom exercises
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
  
      if (exercisesError) throw exercisesError;

      // Load all exercises (global + custom)
      const { data: allExercisesData, error: allExercisesError } = await supabase
        .from('exercises')
        .select('*')
        .order('name');

      if (allExercisesError) throw allExercisesError;

      setSessions(sessionsData || []);
      setRoutines(routinesData || []);
      setCustomExercises(exercisesData || []);
      setAllExercises(allExercisesData || []);
    } catch (error) {
      console.error('Error loading workout data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (type: 'session' | 'routine' | 'custom_exercise', item: WorkoutSession | WorkoutRoutine | Exercise) => {
    setDeleteConfirmation({
      isOpen: true,
      type,
      id: item.id,
      name: item.name,
      date: 'date' in item ? formatDate(item.date).toLocaleDateString() : undefined,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation.id) return;

    try {
      const table = deleteConfirmation.type === 'session' ? 'workout_sessions' : (deleteConfirmation.type === 'routine' ? 'workout_routines' : 'exercises');
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', deleteConfirmation.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error(`Error deleting ${deleteConfirmation.type}:`, error);
    } finally {
      setDeleteConfirmation({ isOpen: false, type: 'session', id: null, name: '' });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation({ isOpen: false, type: 'session', id: null, name: '' });
  };

  const handleCompleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('workout_sessions')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  const handleExerciseSelect = (exercise: Exercise) => {
    navigate(`/workouts/log-exercise?exercise=${exercise.id}`);
    setShowStartWorkout(false);
  };

  const getThisWeekSessions = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return sessions.filter(session => 
      new Date(session.date) >= oneWeekAgo && session.status === 'completed'
    );
  };

  const getTotalDuration = () => {
    return sessions
      .filter(session => session.status === 'completed')
      .reduce((total, session) => total + (session.duration_minutes || 0), 0);
  };

  const getCompletedSessionsCount = () => {
    return sessions.filter(session => session.status === 'completed').length;
  };

  const filteredExercises = allExercises.filter(exercise =>
    exercise.name.toLowerCase().includes(exerciseSearchTerm.toLowerCase()) ||
    exercise.muscle_group.toLowerCase().includes(exerciseSearchTerm.toLowerCase())
  );

  const filteredCustomExercises = customExercises.filter(exercise =>
    exercise.name.toLowerCase().includes(customExerciseSearchTerm.toLowerCase()) ||
    exercise.muscle_group.toLowerCase().includes(customExerciseSearchTerm.toLowerCase())
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
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Delete {deleteConfirmation.type === 'session' ? 'Workout' : 'Routine'}
                  </h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Are you sure you want to delete{' '}
                  <span className="font-medium">"{deleteConfirmation.name}"</span>
                  {deleteConfirmation.date && (
                    <> from <span className="font-medium">{deleteConfirmation.date}</span></>
                  )}?
                  {deleteConfirmation.type === 'routine' && (
                    <> This will also delete all workout sessions using this routine.</>
                  )}
                  {' '}This action cannot be undone.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm lg:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm lg:text-base"
                >
                  Delete {deleteConfirmation.type === 'session' ? 'Workout' : (deleteConfirmation.type === 'routine' ? 'Routine' : 'Exercise')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Start Workout Modal */}
      {showStartWorkout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto">
            <div className="p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Start Workout
                </h3>
                <button
                  onClick={() => setShowStartWorkout(false)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-400 p-1"
                >
                  <X className="h-5 w-5 lg:h-6 lg:w-6" />
                </button>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-600 mb-4">
                <nav className="-mb-px flex">
                  <button
                    onClick={() => setStartWorkoutTab('routines')}
                    className={`flex-1 py-2 px-1 text-center border-b-2 font-medium text-sm ${
                      startWorkoutTab === 'routines'
                        ? 'border-blue-500 dark:border-blue-300 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-200'
                    }`}
                  >
                    Routines
                  </button>
                  <button
                    onClick={() => setStartWorkoutTab('exercises')}
                    className={`flex-1 py-2 px-1 text-center border-b-2 font-medium text-sm ${
                      startWorkoutTab === 'exercises'
                        ? 'border-blue-500 dark:border-blue-300 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-200'
                    }`}
                  >
                    Log Exercise
                  </button>
                </nav>
              </div>

              {/* Tab Content */}
              {startWorkoutTab === 'routines' ? (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Select a routine to start a full workout:
                  </p>
                  <div className="space-y-2 mb-4">
                    {routines.map((routine) => (
                      <div key={routine.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm lg:text-base truncate">{routine.name}</h3>
                            {routine.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{routine.description}</p>
                            )}
                          </div>
                          <Link
                            to={`/workouts/start?routine=${routine.id}`}
                            className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded text-xs lg:text-sm hover:bg-blue-700 transition-colors ml-3"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Start
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link
                    to="/workouts/routines/new"
                    className="flex items-center justify-center w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm lg:text-base"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Routine
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <p className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <span>Select an exercise to log:</span>
                      <button
                        onClick={() => {
                          setEditingExercise(null);
                          setShowCustomExerciseForm(true);
                        }}
                        className="flex items-center justify-center px-3 py-2 bg-green-600 text-sm text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Plus className="h-3 w-3 mr-2" />
                        New Custom Exercise
                      </button>
                    </p>
                    
                    {/* Exercise Search */}
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <FormInput
                        type="text"
                        placeholder="Search exercises..."
                        value={exerciseSearchTerm}
                        onChange={(e) => setExerciseSearchTerm(e.target.value)}
                        className="pl-10 pr-4 text-sm"
                      />
                    </div>

                    {/* Exercise List */}
                    <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
                      {filteredExercises.map((exercise) => (
                        <div 
                          key={exercise.id} 
                          className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer"
                          onClick={() => handleExerciseSelect(exercise)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{exercise.name}</h3>
                                {exercise.is_custom && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-400/20 text-green-800 dark:text-green-200">
                                    Custom
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{exercise.muscle_group}</p>
                              {exercise.equipment && (
                                <p className="text-xs text-gray-500">{exercise.equipment}</p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                      ))}
                      {filteredExercises.length === 0 && (
                        <div className="text-center py-8">
                          <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500 mb-2">No exercises found</p>
                          <p className="text-sm text-gray-400">Try adjusting your search</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => setShowStartWorkout(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-sm lg:text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Exercise Form Modal */}
      {showCustomExerciseForm && (
        <>
          {/* Custom Exercise edit/add form */}
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
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">Workouts</h1>
            <p className="mt-2 text-sm lg:text-base text-gray-600 dark:text-gray-400">Manage your workout routines and track your sessions.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/workouts/routines/new"
              className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm lg:text-base whitespace-nowrap"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Routine
            </Link>
            <button
              onClick={() => setShowStartWorkout(true)}
              className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm lg:text-base whitespace-nowrap"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Workout
            </button>
          </div>
        </div>
  
        {/* Stats */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
              <div className="flex items-center">
                <Dumbbell className="h-6 w-6 lg:h-8 lg:w-8 text-purple-600 flex-shrink-0" />
                <div className="ml-3 lg:ml-4 min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">Total Workouts</p>
                  <p className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{getCompletedSessionsCount()}</p>
                </div>
              </div>
            </div>
  
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
              <div className="flex items-center">
                <Calendar className="h-6 w-6 lg:h-8 lg:w-8 text-green-600 flex-shrink-0" />
                <div className="ml-3 lg:ml-4 min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">This Week</p>
                  <p className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{getThisWeekSessions().length}</p>
                </div>
              </div>
            </div>
  
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
              <div className="flex items-center">
                <Clock className="h-6 w-6 lg:h-8 lg:w-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="ml-3 lg:ml-4 min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">Total Time</p>
                  <p className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.round(getTotalDuration() / 60)}h</p>
                </div>
              </div>
            </div>
  
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
              <div className="flex items-center">
                <Play className="h-6 w-6 lg:h-8 lg:w-8 text-orange-600 flex-shrink-0" />
                <div className="ml-3 lg:ml-4 min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">Routines</p>
                  <p className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{routines.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}
  
        {/* Tabs */}
        <div ref={tabsContainerRef} className="border-b border-gray-200 dark:border-gray-600">
          <nav className="-mb-px flex space-x-4 lg:space-x-8 overflow-x-auto">
            <button
              id='sessions'
              ref={sessionsTabRef}
              onClick={() => setActiveTab('sessions')}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'sessions'
                  ? 'border-blue-500 dark:border-blue-300 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-200'
              }`}
            >
              Recent Workouts ({sessions.length})
            </button>
            <button
              id='routines'
              ref={routinesTabRef}
              onClick={() => setActiveTab('routines')}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'routines'
                  ? 'border-blue-500 dark:border-blue-300 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-200'
              }`}
            >
              My Routines ({routines.length})
            </button>
            <button
              id='log_exercise'
              ref={logExerciseTabRef}
              onClick={() => setActiveTab('log_exercise')}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'log_exercise'
                  ? 'border-blue-500 dark:border-blue-300 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-200'
              }`}
            >
              Log Exercise
            </button>
            <button
              id='custom_exercises'
              ref={customExercisesTabRef}
              onClick={() => setActiveTab('custom_exercises')}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'custom_exercises'
                  ? 'border-blue-500 dark:border-blue-300 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-200'
              }`}
            >
              Custom Exercises ({customExercises.length})
            </button>
          </nav>
        </div>
  
        {/* Tab Content */}
        {activeTab === 'sessions' && (
          /* Recent Workouts */
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
            <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-600">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Workouts</h2>
            </div>
            <div className="p-4 lg:p-6">
              {sessions.length > 0 ? (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`flex items-center justify-between p-3 lg:p-4 border rounded-lg transition-colors group ${
                        session.status === 'active' 
                          ? 'border-green-200 dark:border-green-400/40 bg-green-50 dark:bg-green-200/10' 
                          : session.status === 'cancelled'
                          ? 'border-red-200 dark:border-red-400/40 bg-red-50 dark:bg-red-500/10'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/50'
                      }`}
                    >
                      <Link
                        to={session.status === 'active' 
                          ? `/workouts/start?resume=${session.id}` 
                          : `/workouts/session/${session.id}`
                        }
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100 text-sm lg:text-base">{session.name}</p>
                          {getSessionStatusBadge(session)}
                        </div>
                        <div className="flex items-center gap-4 text-xs lg:text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />
                            {formatDate(session.date).toLocaleDateString()}
                          </div>
                          {session.duration_minutes && (
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />
                              {formatMinutes(session.duration_minutes)}
                            </div>
                          )}
                        </div>
                        {session.notes && (
                          <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 truncate mt-1">{session.notes}</p>
                        )}
                      </Link>
                      <div className="flex items-center gap-2 ml-3">
                        {session.status === 'active' && (
                          <>
                            <Link
                              to={`/workouts/start?resume=${session.id}`}
                              className="p-2 text-green-600 hover:text-green-700 transition-colors"
                              title="Resume workout"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCompleteSession(session.id);
                              }}
                              className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-300 transition-colors"
                              title="Mark as complete"
                            >
                              <Square className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteClick('session', session);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 lg:py-12">
                  <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2 text-sm lg:text-base">No workouts logged yet</p>
                  <button
                    onClick={() => setShowStartWorkout(true)}
                    className="mt-2 text-blue-600 hover:text-blue-700 dark:text-blue-300 text-sm font-medium"
                  >
                    Start your first workout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'routines' && (
          /* My Routines */
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
            <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-600">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">My Routines</h2>
            </div>
            <div className="p-4 lg:p-6">
              {routines.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {routines.map((routine) => (
                    <div key={routine.id+routine.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <Link to={`/workouts/routines/${routine.id}/edit`} className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm lg:text-base truncate">{routine.name}</h3>
                          {routine.description && (
                            <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{routine.description}</p>
                          )}
                        </Link>
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 ml-2">
                          <Link
                            to={`/workouts/routines/${routine.id}/edit`}
                            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleDeleteClick('routine', routine)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Link to={`/workouts/routines/${routine.id}/edit`} className="text-xs flex-grow lg:text-sm text-gray-500">
                          Created {new Date(routine.created_at ?? '').toLocaleDateString()}
                        </Link>
                        <Link
                          to={`/workouts/start?routine=${routine.id}`}
                          className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded text-xs lg:text-sm hover:bg-blue-700 transition-colors"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 lg:py-12">
                  <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2 text-sm lg:text-base">No routines created yet</p>
                  <Link
                    to="/workouts/routines/new"
                    className="mt-2 text-blue-600 hover:text-blue-700 dark:text-blue-300 text-sm font-medium"
                  >
                    Create your first routine
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'log_exercise' && (
          <LogExerciseTab
          allExercises={allExercises}
          setEditingExercise={setEditingExercise}
          setShowCustomExerciseForm={setShowCustomExerciseForm}
        />
        )}
        {activeTab === 'custom_exercises' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 lg:p-6 border-b border-gray-200 dark:border-gray-600">
              <div>
                <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">Manage Custom Exercises</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Create, edit, or delete custom exercises.</p>
              </div>
              <button
                onClick={() => {
                  setEditingExercise(null);
                  setShowCustomExerciseForm(true);
                }}
                className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm lg:text-base"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Custom Exercise
              </button>
            </div>
            <div className="p-4 lg:p-6">
              {filteredCustomExercises.length > 0 ? (
                <>
                  <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <FormInput
                      type="text"
                      placeholder="Search exercises..."
                      value={customExerciseSearchTerm}
                      onChange={(e) => setCustomExerciseSearchTerm(e.target.value)}
                      className="pl-10 pr-4"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredCustomExercises.map((exercise) => (
                      <div
                        onClick={() => handleEditExercise(exercise)}
                        key={exercise.id}
                        className="flex items-center cursor-pointer justify-between p-3 lg:p-4 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/50 rounded-lg"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100 text-sm lg:text-base">{exercise.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{exercise.muscle_group}</p>
                          {exercise.equipment && (
                            <p className="text-xs text-gray-500">{exercise.equipment}</p>
                          )}
                        </div>
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 ml-3"
                        >
                          <button
                            onClick={() => handleEditExercise(exercise)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick('custom_exercise', exercise)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-gray-500">No custom exercises found. Add some custom exercises to get started!</p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Log Exercise Tab Component
function LogExerciseTab({ allExercises, setEditingExercise, setShowCustomExerciseForm }: { allExercises: Exercise[], setEditingExercise: React.Dispatch<React.SetStateAction<Exercise|null>>, setShowCustomExerciseForm: React.Dispatch<React.SetStateAction<boolean>> }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredExercises = allExercises.filter(exercise =>
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exercise.muscle_group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 lg:p-6 border-b border-gray-200 dark:border-gray-600">
        <div>
          <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">Log Single Exercise</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Quickly log a single exercise without creating a full routine.</p>
        </div>
        <button
          onClick={() => {
            setEditingExercise(null);
            setShowCustomExerciseForm(true);
          }}
          className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm lg:text-base"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Custom Exercise
        </button>
      </div>
      <div className="p-4 lg:p-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <FormInput
            type="text"
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4"
          />
        </div>

        {/* Exercise Grid */}
        {filteredExercises.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredExercises.map((exercise) => (
              <Link
                to={`/workouts/log-exercise?exercise=${exercise.id}`} 
                key={exercise.id} 
                className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{exercise.name}</h3>
                    {exercise.is_custom && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-400/20 text-green-800 dark:text-green-200">
                        Custom
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{exercise.muscle_group}</p>
                {exercise.equipment && (
                  <p className="text-xs text-gray-500 mt-1">{exercise.equipment}</p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No exercises found</p>
            <p className="text-sm text-gray-400">Try adjusting your search terms</p>
          </div>
        )}
      </div>
    </div>
  );
}