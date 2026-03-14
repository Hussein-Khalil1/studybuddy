import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";
import { CourseGroupActions } from "./CourseGroupActions";

type DashboardPageProps = {
  searchParams?: Promise<{
    startGroups?: string;
  }>;
};

type ProfileRow = {
  username: string;
  onboarding_completed: boolean;
};

type CourseSummary = {
  code: string;
  title: string;
  campus: string;
};

type MyEnrollmentRow = {
  course_id: number;
  courses: CourseSummary[];
};

type MembershipRow = {
  course_id: number;
};

type ClassmateEnrollmentRow = {
  course_id: number;
  user_id: string;
  profiles: {
    username: string;
  }[];
};

type CourseMembershipRow = {
  course_id: number;
  user_id: string;
};

type PendingRequestRow = {
  course_id: number;
  target_user_id: string;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const shouldStartGroupSetup = params?.startGroups === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  const { data: enrollmentRows } = await supabase
    .from("course_enrollments")
    .select("course_id, courses!inner(code, title, campus)")
    .eq("user_id", user.id)
    .returns<MyEnrollmentRow[]>();

  const myCourses = (enrollmentRows ?? [])
    .map((row) => {
      const course = row.courses[0];
      if (!course) return null;
      return {
        courseId: row.course_id,
        course,
      };
    })
    .filter((row): row is { courseId: number; course: CourseSummary } => Boolean(row));

  if (myCourses.length === 0) {
    redirect("/onboarding?edit=1");
  }

  const selectedCourseIds = myCourses.map((item) => item.courseId);

  const [classmatesResponse, membershipsResponse, myMembershipResponse, pendingResponse] = await Promise.all([
    supabase
      .from("course_enrollments")
      .select("course_id, user_id, profiles!course_enrollments_user_id_fkey(username)")
      .in("course_id", selectedCourseIds)
      .neq("user_id", user.id)
      .returns<ClassmateEnrollmentRow[]>(),
    supabase
      .from("group_memberships")
      .select("course_id, user_id")
      .in("course_id", selectedCourseIds)
      .returns<CourseMembershipRow[]>(),
    supabase
      .from("group_memberships")
      .select("course_id")
      .eq("user_id", user.id)
      .in("course_id", selectedCourseIds)
      .returns<MembershipRow[]>(),
    supabase
      .from("group_requests")
      .select("course_id, target_user_id")
      .eq("requester_user_id", user.id)
      .eq("status", "pending")
      .in("course_id", selectedCourseIds)
      .returns<PendingRequestRow[]>(),
  ]);

  const classmatesRows = classmatesResponse.data ?? [];
  const classmateCounts = new Map<number, number>();
  for (const courseId of selectedCourseIds) {
    classmateCounts.set(
      courseId,
      classmatesRows.filter((row) => row.course_id === courseId).length,
    );
  }

  const groupedUserKeys = new Set(
    (membershipsResponse.data ?? []).map((row) => `${row.course_id}:${row.user_id}`),
  );
  const pendingRequestKeys = new Set(
    (pendingResponse.data ?? []).map((row) => `${row.course_id}:${row.target_user_id}`),
  );

  const classmatesByCourse = new Map<
    number,
    { id: string; username: string; hasGroup: boolean; pending: boolean }[]
  >();

  for (const row of classmatesRows) {
    const username = row.profiles?.[0]?.username?.trim() || "Student";
    const hasGroup = groupedUserKeys.has(`${row.course_id}:${row.user_id}`);
    const pending = pendingRequestKeys.has(`${row.course_id}:${row.user_id}`);
    const current = classmatesByCourse.get(row.course_id) ?? [];

    current.push({
      id: row.user_id,
      username,
      hasGroup,
      pending,
    });

    classmatesByCourse.set(row.course_id, current);
  }

  for (const [courseId, classmates] of classmatesByCourse) {
    classmates.sort((a, b) => a.username.localeCompare(b.username));
    classmatesByCourse.set(courseId, classmates);
  }

  const courseIdsWithGroups = new Set((myMembershipResponse.data ?? []).map((row) => row.course_id));

  const username =
    profile.username?.trim().length > 0
      ? profile.username
      : user.email?.split("@")[0] ?? "there";

  return (
    <main className="min-h-screen bg-slate-100 p-6 sm:p-10">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">Welcome back, {username}</h1>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Sign Out
            </button>
          </form>
        </div>

        {shouldStartGroupSetup && (
          <section className="mt-8 rounded-xl border border-sky-200 bg-sky-50 p-4 sm:p-5">
            <h2 className="text-base font-semibold text-sky-900">Group setup is ready</h2>
            <p className="mt-1 text-sm text-sky-800">
              Open a course below to start the guided group setup flow.
            </p>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Your courses</h2>
          <p className="mt-1 text-sm text-slate-600">
            Select a course to find groupmates, manage invites, and finalize your group.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {myCourses.map((item) => {
              const classmates = classmateCounts.get(item.courseId) ?? 0;
              const hasGroup = courseIdsWithGroups.has(item.courseId);

              return (
                <article
                  key={item.courseId}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <Link
                    href={`/dashboard/course/${item.courseId}`}
                    className="block rounded-lg transition hover:bg-slate-100"
                  >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.course.campus}</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">
                    {item.course.code}: {item.course.title}
                  </h3>
                  <p className="mt-3 text-sm text-slate-600">
                    {classmates} classmate{classmates === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {hasGroup ? "You are already in a group" : "You are not in a group yet"}
                  </p>
                  </Link>

                  <CourseGroupActions
                    courseId={item.courseId}
                    classmates={classmatesByCourse.get(item.courseId) ?? []}
                  />
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
