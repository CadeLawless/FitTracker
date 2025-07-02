// Main App component - this is the root of our application
// React Router handles navigation between different pages

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
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
import ProgressPage from './components/ProgressPage';
import Profile from './components/Profile';
import ResetSessionButton from './components/ResetSessionButton';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsGoalSetup, setNeedsGoalSetup] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null);
        
        if (session?.user && event === 'SIGNED_IN') {
          // Check if user needs goal setup
          await checkGoalSetup(session.user.id);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    console.log('checking user...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      console.log('done');
      if (user) {
        await checkGoalSetup(user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkGoalSetup = async (userId: string) => {
    try {
      // Check if user has completed goal setup by looking for profile
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking profile:', error);
      }

      setNeedsGoalSetup(!profile);
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
    return <AuthForm onAuthSuccess={() => checkUser()} />;
  }

  if (needsGoalSetup) {
    return <GoalSetup onComplete={handleGoalSetupComplete} />;
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/weight" element={<WeightTracker />} />
          <Route path="/measurements" element={<MeasurementsTracker />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/workouts/routines/new" element={<RoutineBuilder />} />
          <Route path="/workouts/routines/:id/edit" element={<RoutineBuilder />} />
          <Route path="/workouts/start" element={<WorkoutSession />} />
          <Route path="/workouts/session/:id" element={<WorkoutSessionDetails />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <ResetSessionButton />
    </Router>
  );
}

export default App;