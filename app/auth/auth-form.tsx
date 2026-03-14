"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
    <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">StudyBuddy</h1>
      <p className="mt-1 text-sm text-slate-600">{heading}</p>

      <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => {
            setTab("signin");
            setMessage(null);
          }}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tab === "signin"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600"
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
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600"
          }`}
        >
          Sign Up
        </button>
      </div>

      {tab === "signin" ? (
        <form className="mt-5 space-y-4" onSubmit={handleSignIn}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 transition focus:border-slate-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              minLength={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 transition focus:border-slate-500"
            />
          </label>

          {message ? (
            <p className="text-sm text-rose-600" role="alert">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={handleSignUp}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 transition focus:border-slate-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 transition focus:border-slate-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 transition focus:border-slate-500"
            />
          </label>

          {message ? (
            <p className="text-sm text-rose-600" role="alert">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
      )}
    </section>
  );
}
