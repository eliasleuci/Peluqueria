import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // { id, role, salonId, peluqueroId, nombre }
  const [salon, setSalon] = useState(null); // { id, nombre }
  const [loading, setLoading] = useState(true);

  const loadProfileAndSalon = useCallback(async (userId) => {
    const { data: profileRow, error } = await supabase
      .from('profiles')
      .select('id, role, salon_id, peluquero_id, nombre')
      .eq('id', userId)
      .single();

    if (error || !profileRow) {
      setProfile(null);
      setSalon(null);
      return;
    }

    setProfile({
      id: profileRow.id,
      role: profileRow.role,
      salonId: profileRow.salon_id,
      peluqueroId: profileRow.peluquero_id,
      nombre: profileRow.nombre,
    });

    if (profileRow.salon_id) {
      const { data: salonRow } = await supabase
        .from('salones')
        .select('id, nombre')
        .eq('id', profileRow.salon_id)
        .single();
      setSalon(salonRow ?? null);
    } else {
      setSalon(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfileAndSalon(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setLoading(true);
        await loadProfileAndSalon(newSession.user.id);
        setLoading(false);
      } else {
        setProfile(null);
        setSalon(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfileAndSalon]);

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    salon,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
