'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Package } from 'lucide-react';
import { useSupabaseAuth } from '~/hooks/useSupabaseAuth';
import { validateEmail } from '~/utils/validation';
import { useToast } from '~/hooks/use-toast';
import { supabase } from '~/lib/supabase';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  /**
   * Handle form submission for user login
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear any previous error messages
    setErrors({});
    
    // Validate form inputs before submitting
    const newErrors: { email?: string; password?: string } = {};
    
    // Check email field
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    // Check password field
    if (!password) {
      newErrors.password = 'Password is required';
    }
    
    // If there are validation errors, show them and stop
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Try to log in the user
    setIsLoading(true);
    try {
      const result = await login(email, password);
      
      if (result.success) {
        // Decide destination (respect redirectTo query param)
        const redirectTo = searchParams.get('redirectTo');
        const destination = redirectTo ?? (result.isAdmin ? '/admin' : '/dashboard');

        // Show success toast
        toast({ title: 'Welcome back!', description: 'You have successfully logged in.' });

        // Wait for Supabase to persist cookies, then hard navigate so middleware sees them
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') {
            subscription.unsubscribe();
            window.location.replace(destination);
          }
        });

        // Fallback: if session already present, navigate immediately
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          subscription.unsubscribe();
          window.location.replace(destination);
        }
      } else {
        // Show error message from server
        toast({
          variant: 'destructive',
          title: 'Login failed',
          description: result.error ?? 'An unexpected error occurred',
        });
      }
    } catch (error) {
      // Handle unexpected errors
      console.error('Login error:', error);
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      // Always stop loading state
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="bg-[#10B98120] p-4 rounded-2xl">
                <Package className="h-8 w-8 text-[#10B981]" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Log in to manage your inventory</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors({ ...errors, email: undefined });
                }}
                className={`w-full px-4 py-3 border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-500 ${errors.email ? 'border-red-500' : 'border-gray-200'}`}
                placeholder="you@business.com"
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-2">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors({ ...errors, password: undefined });
                  }}
                  className={`w-full px-4 py-3 border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12 text-gray-900 placeholder-gray-500 ${errors.password ? 'border-red-500' : 'border-gray-200'}`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500 mt-2">{errors.password}</p>
              )}
            </div>

            <button 
              type="submit" 
              className="w-full px-4 py-3 bg-[#059669] text-white font-medium rounded-lg hover:bg-[#059669] focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]" 
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-8 text-center text-sm">
            <span className="text-gray-600">Don&apos;t have an account? </span>
            <Link href="/signup" className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};