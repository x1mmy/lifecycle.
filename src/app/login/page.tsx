import { Suspense } from 'react';
import { LoginForm } from '~/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
