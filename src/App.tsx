// Main App component - this is the root of our application
// React Router handles navigation between different pages

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase, auth } from './lib/supabase';
import { User } from './types';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import AuthForm from './components/AuthForm';
import GoalSetup from './components/GoalSetup';
import Dashboard from './components/Dashboard';
import WeightTracker from './components/WeightTracker';
import MeasurementsTracker from './components/MeasurementsTracker';
import WorkoutsPage from './components/WorkoutsPage';
import RoutineBuilder from './components/RoutineBuilder';
import WorkoutSession from './components/WorkoutSession';
import WorkoutSessionDetails from './components/WorkoutSessionDetails';
import LogExercise from './components/LogExercise';
import GoalsPage from './components/GoalsPage';
import ProgressPage from './components/ProgressPage';
import Profile from './components/Profile';
import ResetPassword from './components/ResetPassword';
import ResetSessionButton from './components/ResetSessionButton';
import ScrollToTop from './components/ScrollToTop';

function App() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsGoalSetup, setNeedsGoalSetup] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          // Optionally delay to avoid race condition
          setTimeout(() => {
            if(session?.user){
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                name: session.user?.user_metadata.name,
                created_at: session.user?.created_at,
              });
            }else{
              setUser(null);
            }
          
            if (session?.user && event === 'SIGNED_IN') {
              // Check if user needs goal setup
              checkGoalSetup(session.user.id);
            }
          }, 100);
        } catch (e) {
          console.error(`[${event} error]`, e);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    console.log('checking user...');
    try {
      const user = await auth.getCurrentUser();
      if(user){
        setUser({
          id: user.id,
          email: user.email || '',
          name: user?.user_metadata.name,
          created_at: user?.created_at,
        });

        await checkGoalSetup(user.id);
      }else{
        setUser(null);
      }
    } catch (error) {
      console.error('Error during getUser:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkGoalSetup = async (userId: string) => {
    try {
      // Check if user has completed goal setup by looking for profile
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('activity_level')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking profile:', error);
      }

      const needsSetup = profile?.activity_level === null;
      setNeedsGoalSetup(needsSetup);
    } catch (error) {
      console.error('Error in checkGoalSetup:', error);
      // If there's an error, assume user needs setup
      setNeedsGoalSetup(true);
    }
  };

  const handleGoalSetupComplete = () => {
    setNeedsGoalSetup(false);
  };

  if (loading) {
    return (
      <>
        <ResetSessionButton />
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </>
    );
  }

  if (!user) {
    return location.pathname === '/reset-password/' ? <ResetPassword /> : <AuthForm onAuthSuccess={() => checkUser()} />;
  }

  if (needsGoalSetup) {
    return <GoalSetup onComplete={handleGoalSetupComplete} />;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <ScrollToTop />
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/weight" element={<WeightTracker />} />
            <Route path="/measurements" element={<MeasurementsTracker />} />
            <Route path="/workouts" element={<WorkoutsPage />} />
            <Route path="/workouts/routines/new" element={<RoutineBuilder />} />
            <Route path="/workouts/routines/:id/edit" element={<RoutineBuilder />} />
            <Route path="/workouts/start" element={<WorkoutSession />} />
            <Route path="/workouts/log-exercise" element={<LogExercise />} />
            <Route path="/workouts/session/:id" element={<WorkoutSessionDetails />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        <ResetSessionButton />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;