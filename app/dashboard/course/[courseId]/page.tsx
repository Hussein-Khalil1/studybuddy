import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GroupmatesList } from "./GroupmatesList";
import { GroupmatesListSkeleton } from "./GroupmatesListSkeleton";
import { GroupSetupRealtime } from "./GroupSetupRealtime";
import { InviteResponseButtons } from "./InviteResponseButtons";

type CourseRow = {
  id: number;
  code: string;
  title: string;
  campus: string;
};

type GroupMembershipRow = {
  user_id: string;
  group_id: number;
  profiles: {
    username: string;
  }[];
};

type InviteRow = {
  id: number;
  requester_user_id: string;
  target_user_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  requester: { username: string }[];
  target: { username: string }[];
};

function parseCourseId(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function CourseDashboardPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId: rawCourseId } = await params;
  const courseId = parseCourseId(rawCourseId);

  if (!courseId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: myEnrollment } = await supabase
    .from("course_enrollments")
    .select("course_id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!myEnrollment) {
    redirect("/dashboard");
  }

  const [{ data: course }, { data: membershipsRaw }, { data: receivedRaw }, { data: sentRaw }] =
    await Promise.all([
      supabase.from("courses").select("id, code, title, campus").eq("id", courseId).maybeSingle<CourseRow>(),
      supabase
        .from("group_memberships")
        .select("user_id, group_id, profiles!group_memberships_user_id_fkey(username)")
        .eq("course_id", courseId)
        .returns<GroupMembershipRow[]>(),
      supabase
        .from("group_requests")
        .select(
          "id, requester_user_id, target_user_id, status, requester:profiles!group_requests_requester_user_id_fkey(username), target:profiles!group_requests_target_user_id_fkey(username)",
        )
        .eq("course_id", courseId)
        .eq("target_user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .returns<InviteRow[]>(),
      supabase
        .from("group_requests")
        .select(
          "id, requester_user_id, target_user_id, status, requester:profiles!group_requests_requester_user_id_fkey(username), target:profiles!group_requests_target_user_id_fkey(username)",
        )
        .eq("course_id", courseId)
        .eq("requester_user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .returns<InviteRow[]>(),
    ]);

  if (!course) {
    redirect("/dashboard");
  }

  const memberships = membershipsRaw ?? [];
  const myMembership = memberships.find((membership) => membership.user_id === user.id);
  const currentGroupId = myMembership?.group_id ?? null;

  const currentGroupMembers = currentGroupId
    ? memberships
        .filter((membership) => membership.group_id === currentGroupId)
        .map((membership) => membership.profiles?.[0]?.username?.trim() || "Student")
        .sort((a, b) => a.localeCompare(b))
    : [];

  const memberCount = currentGroupMembers.length;
  const isGroupReady = currentGroupId !== null && memberCount >= 3 && memberCount <= 5;
  const pendingTargetIds = (sentRaw ?? []).map((request) => request.target_user_id);

  return (
    <main className="min-h-screen bg-slate-100 p-6 sm:p-10">
      <GroupSetupRealtime courseId={courseId} currentUserId={user.id} />

      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Group Setup</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
              {course.code}: {course.title}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{course.campus}</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to courses
          </Link>
        </div>

        {currentGroupId ? (
          <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900">Your current group ({memberCount}/5)</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {currentGroupMembers.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {name}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {isGroupReady ? (
          <section className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Step 3</p>
            <h2 className="mt-1 text-xl font-semibold text-emerald-900">Group is ready!</h2>
            <p className="mt-2 text-sm text-emerald-800">
              {memberCount} members are now in your {course.code} study group.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {currentGroupMembers.map((name) => (
                <span
                  key={`ready-${name}`}
                  className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-800"
                >
                  {name}
                </span>
              ))}
            </div>
            <Link
              href={`/dashboard/course/${courseId}/group/${currentGroupId}`}
              className="mt-4 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Go to Group
            </Link>
          </section>
        ) : (
          <>
            <section className="mt-8">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Step 1</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Find groupmates</h2>
              <p className="mt-1 text-sm text-slate-600">
                Invite classmates in this course who are not already grouped.
              </p>

              <div className="mt-4">
                <Suspense fallback={<GroupmatesListSkeleton />}>
                  <GroupmatesList
                    courseId={courseId}
                    currentUserId={user.id}
                    pendingTargetIds={pendingTargetIds}
                  />
                </Suspense>
              </div>
            </section>

            <section className="mt-8">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Step 2</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Manage invites & requests</h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Incoming invites</h3>
                  <div className="mt-3 space-y-3">
                    {(receivedRaw ?? []).length === 0 ? (
                      <p className="text-sm text-slate-600">No incoming invites right now.</p>
                    ) : (
                      (receivedRaw ?? []).map((invite) => (
                        <div key={invite.id} className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm text-slate-700">
                            {invite.requester?.[0]?.username?.trim() || "Student"} invited you.
                          </p>
                          <div className="mt-2">
                            <InviteResponseButtons courseId={courseId} requestId={invite.id} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>

                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Sent invites</h3>
                  <div className="mt-3 space-y-3">
                    {(sentRaw ?? []).length === 0 ? (
                      <p className="text-sm text-slate-600">No pending sent invites.</p>
                    ) : (
                      (sentRaw ?? []).map((invite) => (
                        <div key={invite.id} className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm text-slate-700">
                            Invite sent to {invite.target?.[0]?.username?.trim() || "Student"}.
                          </p>
                          <p className="mt-1 text-xs text-slate-500">Waiting for response.</p>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
