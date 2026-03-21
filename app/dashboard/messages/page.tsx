import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type MembershipRow = {
  group_id: number;
  course_id: number;
};

type CourseRow = {
  id: number;
  code: string;
  title: string;
};

type GroupMemberRow = {
  group_id: number;
  user_id: string;
  profiles: { username: string } | { username: string }[];
};

type MessageRow = {
  group_id: number;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string } | { username: string }[];
};

function pickName(p: { username: string } | { username: string }[] | null | undefined): string {
  if (!p) return "Student";
  const profile = Array.isArray(p) ? p[0] : p;
  return profile?.username?.trim() || "Student";
}


function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const AVATAR_COLORS = [
  "bg-[#c2708a]",
  "bg-[#9b6ba5]",
  "bg-[#d4956a]",
  "bg-[rgba(42,32,40,0.4)]",
];

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: membershipRows } = await supabase
    .from("group_memberships")
    .select("group_id, course_id")
    .eq("user_id", user.id)
    .returns<MembershipRow[]>();

  const rawMemberships = membershipRows ?? [];
  const courseIds = [...new Set(rawMemberships.map((r) => r.course_id))];

  const { data: courseRows } = courseIds.length > 0
    ? await supabase
        .from("courses")
        .select("id, code, title")
        .in("id", courseIds)
        .returns<CourseRow[]>()
    : { data: [] as CourseRow[] };

  const courseMap = new Map((courseRows ?? []).map((c) => [c.id, c]));

  const myGroups = rawMemberships.map((row) => {
    const c = courseMap.get(row.course_id);
    return {
      group_id: row.group_id,
      course_id: row.course_id,
      course_code: c?.code ?? "",
      course_title: c?.title ?? "",
    };
  });

  const groupIds = myGroups.map((g) => g.group_id);

  let memberRows: GroupMemberRow[] = [];
  let messageRows: MessageRow[] = [];

  if (groupIds.length > 0) {
    const [membersRes, messagesRes] = await Promise.all([
      supabase
        .from("group_memberships")
        .select("group_id, user_id, profiles!group_memberships_user_id_fkey(username)")
        .in("group_id", groupIds)
        .returns<GroupMemberRow[]>(),
      supabase
        .from("group_messages")
        .select("group_id, content, created_at, user_id, profiles!group_messages_user_id_fkey(username)")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .returns<MessageRow[]>(),
    ]);
    memberRows = membersRes.data ?? [];
    messageRows = messagesRes.data ?? [];
  }

  const groups = myGroups.map((g) => {
    const members = memberRows
      .filter((m) => m.group_id === g.group_id)
      .map((m) => ({ user_id: m.user_id, username: pickName(m.profiles) }));
    const lastMsg = messageRows.find((m) => m.group_id === g.group_id);
    return {
      ...g,
      members,
      last_message: lastMsg
        ? {
            content: lastMsg.content,
            sender: pickName(lastMsg.profiles),
            created_at: lastMsg.created_at,
          }
        : null,
    };
  });

  // Sort: groups with messages first (most recent first), then without
  groups.sort((a, b) => {
    if (a.last_message && b.last_message) {
      return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
    }
    if (a.last_message) return -1;
    if (b.last_message) return 1;
    return 0;
  });

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(42,32,40,0.45)] mb-1">
          Messages
        </p>
        <h1 className="text-2xl font-bold text-[#2a2028]">Group Chats</h1>
        <p className="text-sm text-[rgba(42,32,40,0.45)] mt-1">
          All your study group conversations.
        </p>
      </div>

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-8 text-center">
          <div className="text-4xl mb-3">💬</div>
          <h2 className="text-lg font-semibold text-[#2a2028] mb-2">No group chats yet</h2>
          <p className="text-sm text-[rgba(42,32,40,0.45)] mb-4">
            Join a study group to start messaging your groupmates.
          </p>
          <Link
            href="/dashboard/courses"
            className="inline-flex px-4 py-2 rounded-xl bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-sm font-medium hover:opacity-90 transition"
          >
            Find a Group →
          </Link>
        </div>
      )}

      {/* Groups list */}
      <div className="space-y-3">
        {groups.map((group) => (
          <Link
            key={group.group_id}
            href={`/dashboard/course/${group.course_id}/group/${group.group_id}`}
            className="flex items-center gap-4 bg-white rounded-xl border border-[rgba(0,0,0,0.07)] p-4 shadow-sm hover:border-[rgba(194,112,138,0.3)] hover:shadow-md transition-all"
          >
            {/* Course avatar */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#c2708a] to-[#9b6ba5] flex items-center justify-center text-white text-sm font-bold shrink-0">
              {group.course_code.slice(0, 3)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-[#2a2028] truncate">
                  {group.course_code}: {group.course_title}
                </span>
              </div>
              {/* Member avatars */}
              <div className="flex items-center gap-2 mb-1">
                <div className="flex -space-x-1">
                  {group.members.slice(0, 4).map((member, idx) => (
                    <div
                      key={member.user_id}
                      title={member.username}
                      className={`w-5 h-5 rounded-full ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} text-white flex items-center justify-center text-xs font-semibold border border-white`}
                    >
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-[rgba(42,32,40,0.45)]">
                  {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                </span>
              </div>
              {group.last_message ? (
                <p className="text-sm text-[rgba(42,32,40,0.55)] truncate">
                  <span className="font-medium text-[rgba(42,32,40,0.75)]">
                    {group.last_message.sender}:
                  </span>{" "}
                  {group.last_message.content}
                </p>
              ) : (
                <p className="text-sm text-[rgba(42,32,40,0.35)] italic">No messages yet</p>
              )}
            </div>

            {/* Time */}
            {group.last_message && (
              <div className="text-right shrink-0">
                <span className="text-xs text-[rgba(42,32,40,0.35)]">
                  {formatTime(group.last_message.created_at)}
                </span>
              </div>
            )}

            {/* Arrow */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[rgba(42,32,40,0.3)] shrink-0"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
