import { AuthForm } from "./auth-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AuthPageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle<{ onboarding_completed: boolean }>();
      const { count: enrollmentCount } = await supabase
        .from("course_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (profile?.onboarding_completed && (enrollmentCount ?? 0) > 0) {
        redirect("/dashboard");
      }

      redirect("/onboarding?edit=1");
    }
  } catch {
    // Continue rendering auth page when env is missing during local setup.
  }

  const params = searchParams ? await searchParams : undefined;
  const initialTab = params?.tab === "signup" ? "signup" : "signin";

  return (
    <main className="min-h-screen bg-slate-100 p-6 sm:p-10">
      <AuthForm initialTab={initialTab} />
    </main>
  );
}
