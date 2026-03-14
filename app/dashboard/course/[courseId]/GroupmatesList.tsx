import { createClient } from "@/lib/supabase/server";
import { InviteToGroupButton } from "./InviteToGroupButton";

type ClassmateQueryRow = {
  user_id: string;
  profiles: {
    username: string;
  }[];
};

type GroupMembershipRow = {
  user_id: string;
  group_id: number;
};

export async function GroupmatesList({
  courseId,
  currentUserId,
  pendingTargetIds,
}: {
  courseId: number;
  currentUserId: string;
  pendingTargetIds: string[];
}) {
  const supabase = await createClient();

  const [{ data: classmatesRaw }, { data: membershipsRaw }, { data: myMembership }] = await Promise.all([
    supabase
      .from("course_enrollments")
      .select("user_id, profiles!course_enrollments_user_id_fkey(username)")
      .eq("course_id", courseId)
      .neq("user_id", currentUserId)
      .returns<ClassmateQueryRow[]>(),
    supabase
      .from("group_memberships")
      .select("user_id, group_id")
      .eq("course_id", courseId)
      .returns<GroupMembershipRow[]>(),
    supabase
      .from("group_memberships")
      .select("group_id")
      .eq("course_id", courseId)
      .eq("user_id", currentUserId)
      .maybeSingle(),
  ]);

  const memberships = membershipsRaw ?? [];
  const groupByUserId = new Map<string, number>();
  const memberCountsByGroupId = new Map<number, number>();

  for (const row of memberships) {
    if (!groupByUserId.has(row.user_id)) {
      groupByUserId.set(row.user_id, row.group_id);
    }

    memberCountsByGroupId.set(row.group_id, (memberCountsByGroupId.get(row.group_id) ?? 0) + 1);
  }

  const myGroupId = myMembership?.group_id ?? null;
  const myGroupCount = myGroupId ? memberCountsByGroupId.get(myGroupId) ?? 0 : 0;
  const myGroupIsFull = myGroupCount >= 5;
  const pendingSet = new Set(pendingTargetIds);

  const classmates = (classmatesRaw ?? [])
    .map((row) => {
      const profile = row.profiles?.[0];
      const username = profile?.username?.trim() || "Student";
      const classmateGroupId = groupByUserId.get(row.user_id) ?? null;

      return {
        id: row.user_id,
        username,
        hasGroup: classmateGroupId !== null,
      };
    })
    .filter((row) => !row.hasGroup)
    .sort((a, b) => a.username.localeCompare(b.username));

  if (classmates.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        No available classmates to invite right now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {classmates.map((classmate) => (
        <article key={classmate.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{classmate.username}</h3>
            <InviteToGroupButton
              courseId={courseId}
              targetUserId={classmate.id}
              initiallyPending={pendingSet.has(classmate.id)}
              disabled={myGroupIsFull}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
