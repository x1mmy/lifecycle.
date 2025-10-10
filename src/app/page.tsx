import Link from "next/link";

// import { LatestPost } from "~/app/_components/post";
import { api, HydrateClient } from "~/trpc/server";
import { LoginForm } from "~/components/auth/LoginForm";
import { SignUpForm } from "~/components/auth/SignUp";

export default async function Home() {
  

  void api.post.getLatest.prefetch();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-white text-white">
        <LoginForm />
        <SignUpForm />
      </main>
    </HydrateClient>
  );
}
