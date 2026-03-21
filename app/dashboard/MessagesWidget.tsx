"use client";

import Link from "next/link";

type GroupMessage = {
  group_id: number;
  course_id: number;
  course_code: string;
  last_message: { content: string; sender: string; sender_id: string; created_at: string } | null;
  members: { user_id: string; username: string }[];
};

type Props = {
  groups: GroupMessage[];
  currentUserId: string;
};

const AVATAR_COLORS = [
  "bg-[#c2708a]",
  "bg-[#9b6ba5]",
  "bg-[#d4956a]",
  "bg-[rgba(42,32,40,0.4)]",
];

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

export default function MessagesWidget({ groups, currentUserId }: Props) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#2a2028]">Recent Messages</h2>
        <Link
          href="/dashboard/messages"
          className="text-xs font-medium text-[#c2708a] hover:opacity-80 transition-opacity"
        >
          View All →
        </Link>
      </div>

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="text-center py-8">
          <div className="text-3xl mb-2">💬</div>
          <p className="text-sm text-[rgba(42,32,40,0.45)]">No group chats yet.</p>
        </div>
      )}

      {/* Group list */}
      <div className="space-y-3">
        {groups.map((group) => (
          <Link
            key={group.group_id}
            href={`/dashboard/course/${group.course_id}/group/${group.group_id}`}
            className="block bg-white rounded-xl border border-[rgba(0,0,0,0.07)] p-4 hover:border-[rgba(194,112,138,0.3)] hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3">
              {/* Left: course badge + members */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#c2708a] bg-[rgba(194,112,138,0.1)] px-2 py-0.5 rounded-full">
                    {group.course_code}
                  </span>
                  {/* Member avatars */}
                  <div className="flex -space-x-1">
                    {group.members.slice(0, 4).map((member, idx) => (
                      <div
                        key={member.user_id}
                        title={member.username}
                        className={`w-6 h-6 rounded-full ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} text-white flex items-center justify-center text-xs font-semibold border-2 border-white`}
                      >
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {group.members.length > 4 && (
                      <div className="w-6 h-6 rounded-full bg-[rgba(42,32,40,0.15)] text-[#2a2028] flex items-center justify-center text-xs font-semibold border-2 border-white">
                        +{group.members.length - 4}
                      </div>
                    )}
                  </div>
                </div>

                {/* Last message */}
                {group.last_message ? (
                  <p className="text-sm text-[rgba(42,32,40,0.65)] truncate">
                    <span className="font-medium text-[#2a2028]">
                      {group.last_message.sender_id === currentUserId ? "You" : group.last_message.sender}:
                    </span>{" "}
                    {group.last_message.content}
                  </p>
                ) : (
                  <p className="text-sm text-[rgba(42,32,40,0.35)] italic">No messages yet</p>
                )}
              </div>

              {/* Right: time */}
              {group.last_message && (
                <span className="text-xs text-[rgba(42,32,40,0.35)] shrink-0 mt-0.5">
                  {formatTime(group.last_message.created_at)}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
