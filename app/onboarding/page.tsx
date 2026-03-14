import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

type Course = {
  id: number;
  code: string;
  title: string;
  campus: string;
};

type EnrollmentRow = {
  course_id: number;
};

type ProfileRow = {
  onboarding_completed: boolean;
};

type OnboardingPageProps = {
  searchParams?: Promise<{
    edit?: string;
  }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();
  const { data: enrollmentRows } = await supabase
    .from("course_enrollments")
    .select("course_id")
    .eq("user_id", user.id);
  const hasEnrollments = (enrollmentRows?.length ?? 0) > 0;
  const shouldForceEdit = params?.edit === "1";
  if (profile?.onboarding_completed && hasEnrollments && !shouldForceEdit) {
    redirect("/dashboard");
  }

  const courseRows: Course[] = [];
  const pageSize = 1000;
  let start = 0;

  while (true) {
    const end = start + pageSize - 1;
    const { data } = await supabase
      .from("courses")
      .select("id, code, title, campus")
      .order("code", { ascending: true })
      .range(start, end);

    const batch = (data ?? []) as Course[];
    courseRows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    start += pageSize;
  }

  const courses = courseRows;
  const initialSelectedCourseIds = (enrollmentRows ?? []).map(
    (row: EnrollmentRow) => row.course_id,
  );

  return (
    <main className="min-h-screen bg-slate-100 p-6 sm:p-10">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Onboarding
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
          Choose your University of Toronto courses
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          We&apos;ll show you students who are active in the same classes.
        </p>

        {courses.length > 0 ? (
          <OnboardingForm
            courses={courses}
            initialSelectedCourseIds={initialSelectedCourseIds}
          />
        ) : (
          <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Course list is unavailable right now. Please try again in a minute.
          </p>
        )}
      </section>
    </main>
  );
}
