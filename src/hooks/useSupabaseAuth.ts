import { useState, useEffect } from 'react';
import { type User, type Session } from '@supabase/supabase-js';
import { supabase } from '~/lib/supabase';

/**
 * Custom hook for Supabase authentication
 * Handles login, signup, logout, and role management
 */
export const useSupabaseAuth = () => {
  // Authentication state
  const [user, setUser] = useState<User | null>(null);           // Current logged-in user
  const [session, setSession] = useState<Session | null>(null);   // Auth session data
  const [loading, setLoading] = useState(true);                  // Loading state for auth checks
  const [isAdmin, setIsAdmin] = useState(false);                 // Whether user has admin role

  useEffect(() => {
    // Listen for auth state changes (login/logout/session refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Update local state when auth changes
        setSession(session);
        setUser(session?.user ?? null);
        
        // Check if user is admin when they log in
        if (session?.user) {
          setTimeout(() => {
            void checkAdminStatus(session.user.id);
          }, 0);
        } else {
          // Reset admin status when user logs out
          setIsAdmin(false);
        }
      }
    );

    // Check for existing session on page load
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Check admin status if user is already logged in
      if (session?.user) {
        void checkAdminStatus(session.user.id);
      }
      setLoading(false); // Done checking initial auth state
    });

    // Cleanup listener when component unmounts
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Check if user has admin role in database
   * @param userId - The user's UUID from auth.users
   */
  const checkAdminStatus = async (userId: string) => {
    try {
      // Query user_roles table to see if user has 'admin' role
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle(); // Returns null if no admin role found
      
      // Set admin status based on query result
      if (!error && data) {
        setIsAdmin(true);  // User has admin role
      } else {
        setIsAdmin(false); // User is regular user or error occurred
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false); // Default to non-admin on error
    }
  };

  /**
   * Log in user with email and password
   * @param email - User's email address
   * @param password - User's password
   * @returns Object with success status, error message, and admin status
   */
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; isAdmin?: boolean }> => {
    try {
      // Attempt to sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Return error if login failed
      if (error) {
        return { success: false, error: error.message };
      }

      // Check admin status immediately after successful login
      if (data.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        // Convert role data to boolean and update state
        const adminStatus = !!roleData;
        setIsAdmin(adminStatus);
        return { success: true, isAdmin: adminStatus };
      }

      // Fallback for successful login without user data
      return { success: true, isAdmin: false };
    } catch {
      // Handle unexpected errors
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  /**
   * Sign up new user with email, password, and business name
   * @param businessName - User's business name
   * @param email - User's email address
   * @param password - User's password
   * @returns Object with success status and error message if any
   */
  const signup = async (
    businessName: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Set redirect URL for email confirmation
      const redirectUrl = `${window.location.origin}/`;
      
      // Create new user account with Supabase Auth
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl, // Where to redirect after email confirmation
          data: {
            business_name: businessName, // Store business name in user metadata
          },
        },
      });

      // Return error if signup failed
      if (error) {
        return { success: false, error: error.message };
      }

      // Signup successful - user needs to confirm email
      return { success: true };
    } catch {
      // Handle unexpected errors
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  /**
   * Log out current user and clear all auth state
   */
  const logout = async () => {
    // Sign out from Supabase Auth
    await supabase.auth.signOut();
    
    // Clear local auth state
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  // Return auth state and functions for components to use
  return {
    user,                    // Current user object
    session,                 // Current session object
    loading,                 // Whether auth is still loading
    isAdmin,                 // Whether user has admin role
    login,                   // Function to log in user
    signup,                  // Function to sign up new user
    logout,                  // Function to log out user
    isAuthenticated: !!user, // Boolean: is user logged in?
  };
};