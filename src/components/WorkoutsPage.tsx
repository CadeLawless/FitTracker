import React, { useState, useEffect } from 'react';
import { Plus, Dumbbell, Clock, Calendar, Play, Edit2, Trash2, X, AlertTriangle, ChevronRight, RotateCcw, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/date';
import type { WorkoutSession, WorkoutRoutine, Exercise } from '../types';
import { useCustomExercises } from '../hooks/useCustomExercises';
import { CustomExerciseForm } from '../components/CustomExerciseForm';

interface DeleteConfirmation {
  isOpen: boolean;
  type: 'session' | 'routine' | 'custom_exercise';
  id: string | null;
  name: string;
  date?: string;
}

export default function WorkoutsPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [showStartWorkout, setShowSetWorkout] = useState(false);
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
  } = useCustomExercises(setCustomExercises);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sessions' | 'routines' | 'custom_exercises'>('sessions');
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>({
    isOpen: false,
    type: 'session',
    id: null,
    name: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Load workout sessions with routine info, ordered by status and date
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          routine:workout_routines(name)
        `)
        .eq('user_id', user.data.user.id)
        .order('status', { ascending: true }) // active first
        .order('date', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Load workout routines
      const { data: routinesData, error: routinesError } = await supabase
        .from('workout_routines')
        .select('*')
        .eq('user_id', user.data.user.id)
        .order('name');

      if (routinesError) throw routinesError;

      // Load custom exercises
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', user.data.user.id)
        .order('name');
  
      if (exercisesError) throw exercisesError;

      setSessions(sessionsData || []);
      setRoutines(routinesData || []);
      setCustomExercises(exercisesData || []);
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
      const table = deleteConfirmation.type === 'session' ? 'workout_sessions' : (deleteConfirmation.type === 'routines' ? 'workout_routines' : 'exercises');
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

  const getSessionStatusBadge = (session: WorkoutSession) => {
    switch (session.status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Cancelled
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Completed
          </span>
        );
      default:
        return null;
    }
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">
                    Delete {deleteConfirmation.type === 'session' ? 'Workout' : 'Routine'}
                  </h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600">
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
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm lg:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm lg:text-base"
                >
                  Delete {deleteConfirmation.type === 'session' ? 'Workout' : (deleteConfirmation.type === 'routines' ? 'Routine' : 'Exercise')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Start Workout Modal */}
      {showStartWorkout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium mb-2 text-gray-900">
                  Start Workout
                </h3>
                <button
                  onClick={() => setShowSetWorkout(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="h-5 w-5 lg:h-6 lg:w-6" />
                </button>
              </div>
              <div className="mb-6">
                <p className="text-base mb-1 text-gray-600">
                  Select a Routine:
                </p>
                <div className="flex justify-end pt-2 border-t border-gray-200"></div>
                <div className="py-1 space-y-2">
                  {routines.map((routine) => (
                      <div key={routine.id} className="border border-gray-200 rounded-lg p-2 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-gray-900 text-sm lg:text-base truncate">{routine.name}</h3>
                          </div>
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
                <div className="my-4 text-base text-center">
                  <Link
                    to="/workouts/routines/new"
                    className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm lg:text-base"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Make a New Routine
                  </Link>
                </div>
                <div className="my-4 text-right">
                  <button
                    onClick={() => setShowSetWorkout(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm lg:text-base"
                  >
                    Cancel
                  </button>
                </div>
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
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Workouts</h1>
            <p className="mt-2 text-sm lg:text-base text-gray-600">Manage your workout routines and track your sessions.</p>
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
              onClick={() => setShowSetWorkout(true)}
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
              <div className="flex items-center">
                <Dumbbell className="h-6 w-6 lg:h-8 lg:w-8 text-purple-600 flex-shrink-0" />
                <div className="ml-3 lg:ml-4 min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-gray-600">Total Workouts</p>
                  <p className="text-lg lg:text-2xl font-bold text-gray-900">{getCompletedSessionsCount()}</p>
                </div>
              </div>
            </div>
  
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
              <div className="flex items-center">
                <Calendar className="h-6 w-6 lg:h-8 lg:w-8 text-green-600 flex-shrink-0" />
                <div className="ml-3 lg:ml-4 min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-gray-600">This Week</p>
                  <p className="text-lg lg:text-2xl font-bold text-gray-900">{getThisWeekSessions().length}</p>
                </div>
              </div>
            </div>
  
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
              <div className="flex items-center">
                <Clock className="h-6 w-6 lg:h-8 lg:w-8 text-blue-600 flex-shrink-0" />
                <div className="ml-3 lg:ml-4 min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-gray-600">Total Time</p>
                  <p className="text-lg lg:text-2xl font-bold text-gray-900">{Math.round(getTotalDuration() / 60)}h</p>
                </div>
              </div>
            </div>
  
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
              <div className="flex items-center">
                <Play className="h-6 w-6 lg:h-8 lg:w-8 text-orange-600 flex-shrink-0" />
                <div className="ml-3 lg:ml-4 min-w-0 flex-1">
                  <p className="text-xs lg:text-sm font-medium text-gray-600">Routines</p>
                  <p className="text-lg lg:text-2xl font-bold text-gray-900">{routines.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}
  
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sessions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Recent Workouts ({sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('routines')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'routines'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Routines ({routines.length})
            </button>
            <button
              onClick={() => setActiveTab('custom_exercises')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'custom_exercises'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Manage Custom Exercises ({customExercises.length})
            </button>
          </nav>
        </div>
  
        {/* Tab Content */}
        {activeTab === 'sessions' && (
          /* Recent Workouts */
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 lg:p-6 border-b border-gray-200">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900">Recent Workouts</h2>
            </div>
            <div className="p-4 lg:p-6">
              {sessions.length > 0 ? (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`flex items-center justify-between p-3 lg:p-4 border rounded-lg transition-colors group ${
                        session.status === 'active' 
                          ? 'border-green-200 bg-green-50' 
                          : session.status === 'cancelled'
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Link
                        to={session.status === 'active' 
                          ? `/workouts/start?resume=${session.id}` 
                          : `/workouts/session/${session.id}`
                        }
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-900 text-sm lg:text-base">{session.name}</p>
                          {getSessionStatusBadge(session)}
                          {session.routine && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {session.routine.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs lg:text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />
                            {formatDate(session.date).toLocaleDateString()}
                          </div>
                          {session.duration_minutes && (
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />
                              {session.duration_minutes}m
                            </div>
                          )}
                        </div>
                        {session.notes && (
                          <p className="text-xs lg:text-sm text-gray-600 truncate mt-1">{session.notes}</p>
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
                              className="p-2 text-blue-600 hover:text-blue-700 transition-colors"
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
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 lg:py-12">
                  <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2 text-sm lg:text-base">No workouts logged yet</p>
                  <Link
                    to="/workouts/start"
                    className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Start your first workout
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'routines' && (
          /* My Routines */
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 lg:p-6 border-b border-gray-200">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900">My Routines</h2>
            </div>
            <div className="p-4 lg:p-6">
              {routines.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {routines.map((routine) => (
                    <div key={routine.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900 text-sm lg:text-base truncate">{routine.name}</h3>
                          {routine.description && (
                            <p className="text-xs lg:text-sm text-gray-600 mt-1 line-clamp-2">{routine.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
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
                        <span className="text-xs lg:text-sm text-gray-500">
                          Created {new Date(routine.created_at).toLocaleDateString()}
                        </span>
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
                    className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Create your first routine
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'custom_exercises' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 lg:p-6 border-b border-gray-200">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900">Manage Custom Exercises</h2>
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
              {customExercises.length > 0 ? (
                <div className="space-y-4">
                  {customExercises.map((exercise) => (
                    <div
                      key={exercise.id}
                      className="flex items-center justify-between p-3 lg:p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm lg:text-base">{exercise.name}</p>
                        <p className="text-sm text-gray-600">{exercise.muscle_group}</p>
                        {exercise.equipment && (
                          <p className="text-xs text-gray-500">{exercise.equipment}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditExercise(exercise);
                          }}
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