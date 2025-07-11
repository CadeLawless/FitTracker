// Layout component - this wraps around all our pages
// React Router handles navigation between different pages

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Scale, 
  Ruler, 
  Dumbbell, 
  TrendingUp, 
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Target
} from 'lucide-react';
import { auth } from '../lib/supabase';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode; // This allows us to wrap other components
}

export default function Layout({ children }: LayoutProps) {
  const { user, authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const handleSignOut = async () => {
    await auth.signOut();
    navigate('/auth');
  };

  // Navigation items - this makes it easy to add/remove menu items
  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/weight', icon: Scale, label: 'Weight' },
    { path: '/measurements', icon: Ruler, label: 'Measurements' },
    { path: '/workouts', icon: Dumbbell, label: 'Workouts' },
    { path: '/goals', icon: Target, label: 'Goals' },
    { path: '/progress', icon: TrendingUp, label: 'Progress' },
    { path: '/profile', icon: UserIcon, label: 'Profile' },
  ];

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Mobile menu button */}
      <div id="navbar" className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Dumbbell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white">FitTracker</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Navigation Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="grid grid-rows-[auto_1fr_auto] h-[100dvh]">
          {/* Logo/Header - Hidden on mobile (shown in top bar) */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Dumbbell className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">FitTracker</span>
            </div>
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 px-4 overflow-y-auto py-6 lg:py-6 lg:pt-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Sign Out */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center">
              <UserIcon className="h-8 w-8 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <div className="ml-3 flex-1 min-w-0">
                {!authLoading ? (
                  <>
                    <p className="text-sm font-medium max-w-[8rem] text-gray-900 dark:text-white truncate">
                      {user?.name || user?.email || "User"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Fitness Enthusiast</p>
                  </>
                ) : (
                  <div className="h-6 w-[90%] bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div> // Skeleton loading
                )}
              </div>
              <button
                onClick={handleSignOut}
                className="rounded-lg p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Mobile top spacing */}
        <div className="lg:hidden h-16"></div>
        <main className="py-4 lg:py-8 min-h-[100dvh] bg-gray-50 dark:bg-gray-900 transition-colors">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}