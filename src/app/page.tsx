import { redirect } from 'next/navigation';

export default async function Home() {
  // Redirect root path to login page
  redirect('/login');
}
