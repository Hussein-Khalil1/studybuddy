import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteButton } from "./InviteButton";
import { RespondButton } from "./RespondButton";

type CourseSummary = {
  id: number;
  code: string;
  title: string;
  campus: string;
};

type UsernameProfile = { username: string };

type EnrollmentRow = {
  course_id: number;
  courses: CourseSummary | CourseSummary[];
};

type ClassmateRow = {
  course_id: number;
  user_id: string;
  profiles: UsernameProfile | UsernameProfile[];
};

type MembershipRow = {
  group_id: number;
  course_id: number;
  user_id: string;
  profiles: UsernameProfile | UsernameProfile[];
};

type InviteRow = {
  id: number;
  course_id: number;
  requester_user_id: string;
  target_user_id: string;
  requester: UsernameProfile | UsernameProfile[];
  target: UsernameProfile | UsernameProfile[];
};

type SentInviteRow = {
  id: number;
  course_id: number;
  target_user_id: string;
  target: UsernameProfile | UsernameProfile[];
};

// Supabase returns joined rows as either a single object or array depending on PostgREST version
function pickUsername(profiles: UsernameProfile | UsernameProfile[] | null | undefined): string {
  if (!profiles) return "Unknown student";
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return p?.username?.trim() || "Unknown student";
}

function pickOne<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? (val[0] ?? null) : val;
}

export default async function GroupSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: enrollmentRows } = await supabase
    .from("course_enrollments")
    .select("course_id, courses!inner(id, code, title, campus)")
    .eq("user_id", user.id)
    .returns<EnrollmentRow[]>();

  if (!enrollmentRows || enrollmentRows.length === 0) {
    redirect("/onboarding");
  }

  const myCourses = enrollmentRows
    .map((row) => pickOne(row.courses))
    .filter((c): c is CourseSummary => Boolean(c));

  if (myCourses.length === 0) {
    redirect("/onboarding");
  }

  const courseIds = myCourses.map((c) => c.id);

  const [classmatesRes, membershipsRes, receivedRes, sentRes] = await Promise.all([
    supabase
      .from("course_enrollments")
      .select("course_id, user_id, profiles!course_enrollments_user_id_fkey(username)")
      .in("course_id", courseIds)
      .neq("user_id", user.id)
      .returns<ClassmateRow[]>(),
    supabase
      .from("group_memberships")
      .select("group_id, course_id, user_id, profiles!group_memberships_user_id_fkey(username)")
      .in("course_id", courseIds)
      .returns<MembershipRow[]>(),
    supabase
      .from("group_requests")
      .select(
        "id, course_id, requester_user_id, target_user_id, requester:profiles!group_requests_requester_user_id_fkey(username), target:profiles!group_requests_target_user_id_fkey(username)",
      )
      .in("course_id", courseIds)
      .eq("target_user_id", user.id)
      .eq("status", "pending")
      .returns<InviteRow[]>(),
    supabase
      .from("group_requests")
      .select(
        "id, course_id, target_user_id, target:profiles!group_requests_target_user_id_fkey(username)",
      )
      .in("course_id", courseIds)
      .eq("requester_user_id", user.id)
      .eq("status", "pending")
      .returns<SentInviteRow[]>(),
  ]);

  const allMemberships = membershipsRes.data ?? [];
  const allClassmates = classmatesRes.data ?? [];
  const allReceived = receivedRes.data ?? [];
  const allSent = sentRes.data ?? [];

  const myGroupByCourse = new Map<number, number>();
  for (const m of allMemberships) {
    if (m.user_id === user.id) myGroupByCourse.set(m.course_id, m.group_id);
  }

  const groupedUserIds = new Set(allMemberships.map((m) => `${m.course_id}:${m.user_id}`));
  const pendingTargetKeys = new Set(allSent.map((s) => `${s.course_id}:${s.target_user_id}`));

  const receivedByCourse = new Map<number, InviteRow[]>();
  for (const inv of allReceived) {
    const list = receivedByCourse.get(inv.course_id) ?? [];
    list.push(inv);
    receivedByCourse.set(inv.course_id, list);
  }

  const sentByCourse = new Map<number, SentInviteRow[]>();
  for (const s of allSent) {
    const list = sentByCourse.get(s.course_id) ?? [];
    list.push(s);
    sentByCourse.set(s.course_id, list);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 sm:p-10">
      <section className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Group Setup
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Find your study groups
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Send invites to classmates. They must accept before joining your group.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Go to Dashboard
          </Link>
        </div>

        <div className="mt-8 space-y-6">
          {myCourses.map((course) => {
            const myGroupId = myGroupByCourse.get(course.id) ?? null;
            const incomingInvites = receivedByCourse.get(course.id) ?? [];
            const sentInvites = sentByCourse.get(course.id) ?? [];

            const groupMembers = allMemberships
              .filter((m) => m.course_id === course.id && m.group_id === myGroupId)
              .map((m) => ({
                userId: m.user_id,
                username: m.user_id === user.id ? "You" : pickUsername(m.profiles),
              }))
              .sort((a, b) => a.username.localeCompare(b.username));

            const availableClassmates = allClassmates
              .filter(
                (c) =>
                  c.course_id === course.id &&
                  !groupedUserIds.has(`${course.id}:${c.user_id}`),
              )
              .map((c) => ({
                id: c.user_id,
                username: pickUsername(c.profiles),
                pending: pendingTargetKeys.has(`${course.id}:${c.user_id}`),
              }))
              .sort((a, b) => a.username.localeCompare(b.username));

            const myGroupFull = groupMembers.length >= 5;

            return (
              <article
                key={course.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                {/* Course header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {course.campus}
                    </p>
                    <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
                      {course.code}: {course.title}
                    </h2>
                  </div>
                  {myGroupId ? (
                    <Link
                      href={`/dashboard/course/${course.id}/group/${myGroupId}`}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Open Group Chat
                    </Link>
                  ) : (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                      Not in a group yet
                    </span>
                  )}
                </div>

                {myGroupId ? (
                  /* Already in a group */
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-800">
                      Your group · {groupMembers.length}/5 members
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {groupMembers.map((m) => (
                        <span
                          key={m.userId}
                          className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800"
                        >
                          {m.username}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-6">
                    {/* Incoming invites */}
                    {incomingInvites.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Invitations for you
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Accept to join their group
                        </p>
                        <div className="mt-3 space-y-2">
                          {incomingInvites.map((inv) => (
                            <div
                              key={inv.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {pickUsername(inv.requester)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  wants you to join their study group
                                </p>
                              </div>
                              <RespondButton courseId={course.id} requestId={inv.id} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sent invites waiting for response */}
                    {sentInvites.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Invites sent</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Waiting for these students to accept
                        </p>
                        <div className="mt-3 space-y-2">
                          {sentInvites.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                              <p className="text-sm font-semibold text-slate-900">
                                {pickUsername(s.target)}
                              </p>
                              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                                Pending acceptance
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Classmates to invite */}
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Classmates you can invite
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        They will receive an invitation and must accept to join your group
                      </p>
                      {availableClassmates.length === 0 ? (
                        <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                          No classmates available to invite right now.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {availableClassmates.map((c) => (
                            <div
                              key={c.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {c.username}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Enrolled in {course.code}
                                </p>
                              </div>
                              <InviteButton
                                courseId={course.id}
                                targetUserId={c.id}
                                initiallyPending={c.pending}
                                disabled={myGroupFull}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
