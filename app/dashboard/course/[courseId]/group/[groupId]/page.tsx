import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type MemberRow = {
  user_id: string;
  group_id: number;
  profiles: { username: string }[];
};

type CourseRow = {
  id: number;
  code: string;
  title: string;
};

function parseNumericId(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ courseId: string; groupId: string }>;
}) {
  const resolved = await params;
  const courseId = parseNumericId(resolved.courseId);
  const groupId = parseNumericId(resolved.groupId);

  if (!courseId || !groupId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const [{ data: enrollment }, { data: myMembership }, { data: course }, { data: membersRaw }] =
    await Promise.all([
      supabase
        .from("course_enrollments")
        .select("course_id")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .maybeSingle(),
      supabase
        .from("group_memberships")
        .select("group_id")
        .eq("course_id", courseId)
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("courses").select("id, code, title").eq("id", courseId).maybeSingle<CourseRow>(),
      supabase
        .from("group_memberships")
        .select("user_id, group_id, profiles!group_memberships_user_id_fkey(username)")
        .eq("course_id", courseId)
        .eq("group_id", groupId)
        .returns<MemberRow[]>(),
    ]);

  if (!enrollment || !myMembership || !course) {
    redirect(`/dashboard/course/${courseId}`);
  }

  const members = (membersRaw ?? [])
    .map((member) => member.profiles?.[0]?.username?.trim() || "Student")
    .sort((a, b) => a.localeCompare(b));

  return (
    <main className="min-h-screen bg-slate-100 p-6 sm:p-10">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Study Group</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
          Group #{groupId} · {course.code}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{course.title}</p>

        <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Members ({members.length})</h2>
          <ul className="mt-3 space-y-2">
            {members.map((name) => (
              <li key={name} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                {name}
              </li>
            ))}
          </ul>
        </section>

        <Link
          href={`/dashboard/course/${courseId}`}
          className="mt-6 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Back to Group Setup
        </Link>
      </section>
    </main>
  );
}
