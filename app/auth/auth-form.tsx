"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthTab = "signin" | "signup";
type ProfileSyncArgs = {
  fallbackUsername?: string;
};

export function AuthForm({ initialTab }: { initialTab: AuthTab }) {
  const router = useRouter();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  function authErrorMessage(message: string | undefined, fallback: string) {
    if (!message) {
      return fallback;
    }

    if (message.toLowerCase().includes("user already registered")) {
      return "An account with this email already exists. Try signing in.";
    }

    if (message.toLowerCase().includes("password")) {
      return message;
    }

    return message;
  }

  function resolveUsername(raw: string | undefined, fallbackEmail?: string | null) {
    if (typeof raw === "string" && raw.trim().length >= 3) {
      return raw.trim();
    }

    const emailPrefix = fallbackEmail?.split("@")[0]?.trim();
    if (emailPrefix && emailPrefix.length >= 3) {
      return emailPrefix;
    }

    return "student";
  }

  async function syncProfile(
    supabase: SupabaseClient,
    { fallbackUsername }: ProfileSyncArgs = {},
  ) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw userError ?? new Error("Authenticated user not found.");
    }

    const syncedUsername = resolveUsername(
      fallbackUsername ??
        (typeof user.user_metadata?.username === "string"
          ? user.user_metadata.username
          : undefined),
      user.email,
    );
    const now = new Date().toISOString();
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? null,
        username: syncedUsername,
        updated_at: now,
        last_sign_in_at: now,
        is_online: true,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      throw profileError;
    }
  }

  const heading = useMemo(
    () => (tab === "signin" ? "Sign in to StudyBuddy" : "Create your account"),
    [tab],
  );

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(
          authErrorMessage(error.message, "Incorrect email or password"),
        );
        return;
      }

      try {
        await syncProfile(supabase);
      } catch (profileSyncError) {
        console.error("Profile sync failed after sign-in:", profileSyncError);
      }

      router.push("/onboarding");
      router.refresh();
    } catch (error) {
      setMessage(
        authErrorMessage(
          error instanceof Error ? error.message : undefined,
          "Incorrect email or password",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
        },
      });

      if (error) {
        setMessage(
          authErrorMessage(error.message, "Unable to create account. Please try again."),
        );
        return;
      }

      if (!data.session) {
        setMessage(
          "Account created. Check your email to confirm your account, then sign in.",
        );
        setPassword("");
        setTab("signin");
        return;
      }

      try {
        await syncProfile(supabase, { fallbackUsername: username });
      } catch (profileSyncError) {
        console.error("Profile sync failed after sign-up:", profileSyncError);
      }

      router.push("/onboarding");
      router.refresh();
    } catch (error) {
      setMessage(
        authErrorMessage(
          error instanceof Error ? error.message : undefined,
          "Unable to create account. Please try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative w-full">
      <div className="fixed top-6 left-6 z-50">
      <Link
        href="/"
        className="bg-white text-center w-32 rounded-xl h-9 relative text-black text-xs font-medium tracking-wide group flex items-center active:scale-95 transition-transform"
      >
        <div className="bg-[#c2708a] rounded-lg h-7 w-1/4 flex items-center justify-center absolute left-1 top-[4px] group-hover:w-[116px] z-10 transition-all duration-500">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" height="14px" width="14px">
            <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" fill="#ffffff" />
            <path d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z" fill="#ffffff" />
          </svg>
        </div>
        <p className="translate-x-2 w-full text-center">Go Back</p>
      </Link>
      </div>

      <section className="mx-auto w-full max-w-md rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white p-6 shadow-sm">
      <Image src="/logo.png" alt="StudyBuddy" width={140} height={36} style={{ height: "36px", width: "auto" }} priority />
      <p className="mt-2 text-sm text-[rgba(42,32,40,0.55)]">{heading}</p>

      <div className="mt-6 grid grid-cols-2 rounded-lg bg-[#f2eeec] p-1">
        <button
          type="button"
          onClick={() => {
            setTab("signin");
            setMessage(null);
          }}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "signin"
              ? "bg-white text-[#2a2028] shadow-sm"
              : "text-[rgba(42,32,40,0.55)]"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("signup");
            setMessage(null);
          }}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "signup"
              ? "bg-white text-[#2a2028] shadow-sm"
              : "text-[rgba(42,32,40,0.55)]"
          }`}
        >
          Sign Up
        </button>
      </div>

      <div className="mt-5 overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: tab === "signin" ? "translateX(0)" : "translateX(-50%)", width: "200%" }}
        >
          {/* Sign In form */}
          <form className="w-1/2 min-w-0 shrink-0 space-y-4" onSubmit={handleSignIn}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[#2a2028]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="w-full rounded-lg border border-[rgba(0,0,0,0.12)] px-3 py-2 text-[#2a2028] outline-none ring-0 transition focus:border-[#c2708a]"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[#2a2028]">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                minLength={8}
                className="w-full rounded-lg border border-[rgba(0,0,0,0.12)] px-3 py-2 text-[#2a2028] outline-none ring-0 transition focus:border-[#c2708a]"
              />
            </label>

            {message && tab === "signin" ? (
              <p className="text-sm text-rose-600" role="alert">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Sign Up form */}
          <form className="w-1/2 min-w-0 shrink-0 space-y-4" onSubmit={handleSignUp}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[#2a2028]">
                Username
              </span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                minLength={3}
                maxLength={32}
                className="w-full rounded-lg border border-[rgba(0,0,0,0.12)] px-3 py-2 text-[#2a2028] outline-none ring-0 transition focus:border-[#c2708a]"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[#2a2028]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="w-full rounded-lg border border-[rgba(0,0,0,0.12)] px-3 py-2 text-[#2a2028] outline-none ring-0 transition focus:border-[#c2708a]"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[#2a2028]">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full rounded-lg border border-[rgba(0,0,0,0.12)] px-3 py-2 text-[#2a2028] outline-none ring-0 transition focus:border-[#c2708a]"
              />
            </label>

            {message && tab === "signup" ? (
              <p className="text-sm text-rose-600" role="alert">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </section>
    </div>
  );
}
