'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, ArrowLeft, Mail } from 'lucide-react';
import { validateEmail } from '~/utils/validation';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const requestReset = api.settings.requestPasswordReset.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: 'Email sent',
        description: 'Check your inbox for password reset instructions.',
      });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to send reset email. Please try again.',
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (!email) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email');
      return;
    }

    requestReset.mutate({ email });
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <div className="bg-green-100 p-4 rounded-full">
                  <Mail className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
              <p className="text-gray-600">
                We&apos;ve sent password reset instructions to <strong>{email}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-500 text-center">
                Didn&apos;t receive the email? Check your spam folder or try again.
              </p>

              <button
                onClick={() => {
                  setIsSubmitted(false);
                  setEmail('');
                }}
                className="w-full px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all"
              >
                Try another email
              </button>

              <Link
                href="/login"
                className="block w-full px-4 py-3 bg-[#5046e6] text-white font-medium rounded-lg hover:bg-[#3d34b8] text-center transition-all"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="bg-[#5146e620] p-4 rounded-2xl">
                <Package className="h-8 w-8 text-[#5046e6]" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password?</h1>
            <p className="text-gray-600">Enter your email to receive reset instructions</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(undefined);
                }}
                className={`w-full px-4 py-3 border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-500 ${error ? 'border-red-500' : 'border-gray-200'}`}
                placeholder="you@business.com"
              />
              {error && (
                <p className="text-sm text-red-500 mt-2">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full px-4 py-3 bg-[#5046e6] text-white font-medium rounded-lg hover:bg-[#3d34b8] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              disabled={requestReset.isPending}
            >
              {requestReset.isPending ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          {/* Back to Login Link */}
          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
