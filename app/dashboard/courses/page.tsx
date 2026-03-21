import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CourseGroupActions } from "../CourseGroupActions";

type CourseSummary = {
  code: string;
  title: string;
  campus: string;
};

type MyEnrollmentRow = {
  course_id: number;
  courses: CourseSummary | CourseSummary[];
};

type MembershipRow = {
  course_id: number;
};

type UsernameProfile = { username: string };

type ClassmateEnrollmentRow = {
  course_id: number;
  user_id: string;
  profiles: UsernameProfile | UsernameProfile[];
};

function pickUsername(p: UsernameProfile | UsernameProfile[] | null | undefined): string {
  if (!p) return "Student";
  const profile = Array.isArray(p) ? p[0] : p;
  return profile?.username?.trim() || "Student";
}

type CourseMembershipRow = {
  course_id: number;
  user_id: string;
};

type PendingRequestRow = {
  course_id: number;
  target_user_id: string;
};

export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: enrollmentRows } = await supabase
    .from("course_enrollments")
    .select("course_id, courses!inner(code, title, campus)")
    .eq("user_id", user.id)
    .returns<MyEnrollmentRow[]>();

  const myCourses = (enrollmentRows ?? [])
    .map((row) => {
      const c = row.courses;
      const course = Array.isArray(c) ? (c[0] ?? null) : (c ?? null);
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

  const [classmatesResponse, membershipsResponse, myMembershipResponse, pendingResponse] =
    await Promise.all([
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
      classmatesRows.filter((row) => row.course_id === courseId).length
    );
  }

  const groupedUserKeys = new Set(
    (membershipsResponse.data ?? []).map((row) => `${row.course_id}:${row.user_id}`)
  );
  const pendingRequestKeys = new Set(
    (pendingResponse.data ?? []).map((row) => `${row.course_id}:${row.target_user_id}`)
  );

  const classmatesByCourse = new Map<
    number,
    { id: string; username: string; hasGroup: boolean; pending: boolean }[]
  >();

  for (const row of classmatesRows) {
    const username = pickUsername(row.profiles);
    const hasGroup = groupedUserKeys.has(`${row.course_id}:${row.user_id}`);
    const pending = pendingRequestKeys.has(`${row.course_id}:${row.user_id}`);
    const current = classmatesByCourse.get(row.course_id) ?? [];
    current.push({ id: row.user_id, username, hasGroup, pending });
    classmatesByCourse.set(row.course_id, current);
  }

  for (const [courseId, classmates] of classmatesByCourse) {
    classmates.sort((a, b) => a.username.localeCompare(b.username));
    classmatesByCourse.set(courseId, classmates);
  }

  const courseIdsWithGroups = new Set(
    (myMembershipResponse.data ?? []).map((row) => row.course_id)
  );

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(42,32,40,0.45)] mb-1">
          Courses
        </p>
        <h1 className="text-2xl font-bold text-[#2a2028]">Your Courses</h1>
        <p className="text-sm text-[rgba(42,32,40,0.45)] mt-1">
          Select a course to find groupmates, manage invites, and finalize your group.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {myCourses.map((item) => {
          const classmates = classmateCounts.get(item.courseId) ?? 0;
          const hasGroup = courseIdsWithGroups.has(item.courseId);

          return (
            <article
              key={item.courseId}
              className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] p-4 shadow-sm hover:border-[rgba(194,112,138,0.25)] transition-all"
            >
              <Link
                href={`/dashboard/course/${item.courseId}`}
                className="block rounded-lg transition hover:opacity-90"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[rgba(42,32,40,0.45)]">
                  {item.course.campus}
                </p>
                <h3 className="mt-1 text-base font-semibold text-[#2a2028]">
                  {item.course.code}: {item.course.title}
                </h3>
                <p className="mt-3 text-sm text-[rgba(42,32,40,0.55)]">
                  {classmates} classmate{classmates === 1 ? "" : "s"}
                </p>
                <p
                  className={`mt-1 text-sm font-medium ${
                    hasGroup ? "text-[#c2708a]" : "text-[rgba(42,32,40,0.45)]"
                  }`}
                >
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
    </div>
  );
}
