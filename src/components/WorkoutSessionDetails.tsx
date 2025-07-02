import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Calendar, Dumbbell, Target, TrendingUp, Edit2, Trash2, Save, X, RotateCcw } from 'lucide-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/date';
import type { WorkoutSession, ExerciseSet, Exercise } from '../types';

interface WorkoutSessionWithSets extends WorkoutSession {
  sets: (ExerciseSet & { exercise: Exercise })[];
}

export default function WorkoutSessionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<WorkoutSessionWithSets | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSet, setEditingSet] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ weight: '', reps: '' });

  useEffect(() => {
    if (id) {
      loadWorkoutSession();
    }
  }, [id]);

  const loadWorkoutSession = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Load workout session
      const { data: sessionData, error: sessionError } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          routine:workout_routines(name)
        `)
        .eq('id', id)
        .eq('user_id', user.data.user.id)
        .single();

      if (sessionError) throw sessionError;

      // Load exercise sets with exercise details
      const { data: setsData, error: setsError } = await supabase
        .from('exercise_sets')
        .select(`
          *,
          exercise:exercises(*)
        `)
        .eq('workout_session_id', id)
        .order('exercise_id, set_number');

      if (setsError) throw setsError;

      setSession({
        ...sessionData,
        sets: setsData || [],
      });
    } catch (error) {
      console.error('Error loading workout session:', error);
      navigate('/workouts');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSet = (set: ExerciseSet) => {
    setEditingSet(set.id);
    setEditFormData({
      weight: set.weight?.toString() || '',
      reps: set.reps?.toString() || '',
    });
  };

  const handleSaveSet = async (setId: string) => {
    try {
      const { error } = await supabase
        .from('exercise_sets')
        .update({
          weight: editFormData.weight ? parseFloat(editFormData.weight) : null,
          reps: editFormData.reps ? parseInt(editFormData.reps) : null,
        })
        .eq('id', setId);

      if (error) throw error;

      setEditingSet(null);
      loadWorkoutSession();
    } catch (error) {
      console.error('Error updating set:', error);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    if (!confirm('Are you sure you want to delete this set?')) return;

    try {
      const { error } = await supabase
        .from('exercise_sets')
        .delete()
        .eq('id', setId);

      if (error) throw error;
      loadWorkoutSession();
    } catch (error) {
      console.error('Error deleting set:', error);
    }
  };

  const handleCompleteSession = async () => {
    if (!session || session.status !== 'active') return;

    try {
      const { error } = await supabase
        .from('workout_sessions')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (error) throw error;
      loadWorkoutSession();
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  const getExerciseGroups = () => {
    if (!session) return [];
    
    const groups = session.sets.reduce((acc, set) => {
      const exerciseId = set.exercise_id;
      if (!acc[exerciseId]) {
        acc[exerciseId] = {
          exercise: set.exercise,
          sets: [],
        };
      }
      acc[exerciseId].sets.push(set);
      return acc;
    }, {} as Record<string, { exercise: Exercise; sets: ExerciseSet[] }>);

    return Object.values(groups);
  };

  const getTotalVolume = () => {
    if (!session) return 0;
    return session.sets.reduce((total, set) => {
      return total + ((set.weight || 0) * (set.reps || 0));
    }, 0);
  };

  const getTotalSets = () => {
    return session?.sets.length || 0;
  };

  const getTotalReps = () => {
    if (!session) return 0;
    return session.sets.reduce((total, set) => total + (set.reps || 0), 0);
  };

  const getAverageWeight = () => {
    if (!session || session.sets.length === 0) return 0;
    const setsWithWeight = session.sets.filter(set => set.weight);
    if (setsWithWeight.length === 0) return 0;
    const totalWeight = setsWithWeight.reduce((total, set) => total + (set.weight || 0), 0);
    return totalWeight / setsWithWeight.length;
  };

  const getSessionStatusBadge = () => {
    if (!session) return null;
    
    switch (session.status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active Session
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Workout session not found</p>
        <button
          onClick={() => navigate('/workouts')}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          Back to Workouts
        </button>
      </div>
    );
  }

  const exerciseGroups = getExerciseGroups();

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/workouts')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{session.name}</h1>
            {getSessionStatusBadge()}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {formatDate(session.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            {session.duration_minutes && (
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {session.duration_minutes} minutes
              </div>
            )}
            {session.routine && (
              <div className="flex items-center">
                <Target className="h-4 w-4 mr-1" />
                {session.routine.name}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.status === 'active' && (
            <>
              <Link
                to={`/workouts/start?resume=${session.id}`}
                className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Resume
              </Link>
              <button
                onClick={handleCompleteSession}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Mark Complete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Workout Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center">
            <Dumbbell className="h-6 w-6 lg:h-8 lg:w-8 text-purple-600 flex-shrink-0" />
            <div className="ml-3 lg:ml-4 min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-medium text-gray-600">Total Sets</p>
              <p className="text-lg lg:text-2xl font-bold text-gray-900">{getTotalSets()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center">
            <Target className="h-6 w-6 lg:h-8 lg:w-8 text-blue-600 flex-shrink-0" />
            <div className="ml-3 lg:ml-4 min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-medium text-gray-600">Total Reps</p>
              <p className="text-lg lg:text-2xl font-bold text-gray-900">{getTotalReps()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center">
            <TrendingUp className="h-6 w-6 lg:h-8 lg:w-8 text-green-600 flex-shrink-0" />
            <div className="ml-3 lg:ml-4 min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-medium text-gray-600">Total Volume</p>
              <p className="text-lg lg:text-2xl font-bold text-gray-900">{getTotalVolume().toLocaleString()} lbs</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center">
            <Clock className="h-6 w-6 lg:h-8 lg:w-8 text-orange-600 flex-shrink-0" />
            <div className="ml-3 lg:ml-4 min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-medium text-gray-600">Avg Weight</p>
              <p className="text-lg lg:text-2xl font-bold text-gray-900">{getAverageWeight().toFixed(1)} lbs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Exercise Details */}
      <div className="space-y-6">
        {exerciseGroups.map((group, index) => (
          <div key={group.exercise.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 lg:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{group.exercise.name}</h3>
                  <p className="text-sm text-gray-600">{group.exercise.muscle_group}</p>
                  {group.exercise.equipment && (
                    <p className="text-xs text-gray-500">{group.exercise.equipment}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{group.sets.length} sets</p>
                  <p className="text-xs text-gray-500">
                    {group.sets.reduce((total, set) => total + (set.reps || 0), 0)} total reps
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 lg:p-6">
              <div className="space-y-3">
                {group.sets.map((set, setIndex) => (
                  <div key={set.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-600 w-12">
                        Set {set.set_number}
                      </span>
                      
                      {editingSet === set.id ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              value={editFormData.weight}
                              onChange={(e) => setEditFormData({ ...editFormData, weight: e.target.value })}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Weight"
                            />
                            <span className="text-xs text-gray-500">lbs</span>
                          </div>
                          <span className="text-gray-400">×</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editFormData.reps}
                              onChange={(e) => setEditFormData({ ...editFormData, reps: e.target.value })}
                              className="w-12 px-2 py-1 border border-gray-300 rounded text-sm"
                              placeholder="Reps"
                            />
                            <span className="text-xs text-gray-500">reps</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {set.weight ? `${set.weight} lbs` : 'No weight'}
                          </span>
                          <span className="text-gray-400">×</span>
                          <span className="text-sm font-medium text-gray-900">
                            {set.reps || 0} reps
                          </span>
                          {set.weight && set.reps && (
                            <span className="text-xs text-gray-500 ml-2">
                              ({(set.weight * set.reps).toLocaleString()} lbs volume)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {editingSet === set.id ? (
                        <>
                          <button
                            onClick={() => handleSaveSet(set.id)}
                            className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingSet(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditSet(set)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSet(set.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notes Section */}
      {session.notes && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Workout Notes</h3>
          <p className="text-gray-700">{session.notes}</p>
        </div>
      )}

      {/* Empty State */}
      {exerciseGroups.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 lg:p-12 text-center">
          <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">No exercises logged for this workout</p>
          <p className="text-sm text-gray-400">
            {session.status === 'active' 
              ? 'Resume this session to start logging exercises.'
              : 'This workout session doesn\'t have any recorded sets.'
            }
          </p>
        </div>
      )}
    </div>
  );
}