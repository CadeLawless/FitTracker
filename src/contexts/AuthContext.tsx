import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  authLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        console.error('Failed to fetch user:', error);
        setUser(null);
      } else {
        if (data?.user){
          setUser({
            id: data.user.id,
            email: data.user.email || '',
            name: data.user?.user_metadata.name,
            birth_date: data.user?.user_metadata.birth_date,
            gender: data.user?.user_metadata.gender,
            created_at: data.user?.created_at,
          });
        }
      }
      setAuthLoading(false);
    };

    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user){
        setUser({
          id: session.user.id,
          email: session.user?.user_metadata.email || '',
          name: session.user?.user_metadata.name,
          birth_date: session.user?.user_metadata.birth_date,
          gender: session.user?.user_metadata.gender,
          created_at: session.user?.created_at,
        });
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
