import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotificationActions from "./NotificationActions";
import CollabInviteActions from "./CollabInviteActions";

type RequestRow = {
  id: number;
  course_id: number;
  request_type: string;
  created_at: string;
  updated_at: string;
  target_group_id: number | null;
  profiles: { username: string } | { username: string }[] | null;
  courses: { code: string; title: string } | { code: string; title: string }[] | null;
};

type CollabInviteRow = {
  id: number;
  created_at: string;
  profiles: { username: string } | { username: string }[] | null;
  courses: { code: string; title: string } | { code: string; title: string }[] | null;
};

function pickName(p: { username: string } | { username: string }[] | null | undefined): string {
  if (!p) return "Student";
  const profile = Array.isArray(p) ? p[0] : p;
  return profile?.username?.trim() || "Student";
}

function pickCourse(c: { code: string; title: string } | { code: string; title: string }[] | null | undefined) {
  if (!c) return { code: "", title: "" };
  return Array.isArray(c) ? (c[0] ?? { code: "", title: "" }) : c;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const [{ data: incomingRaw }, { data: acceptedRaw }, { data: collabInvitesRaw }] = await Promise.all([
    // Pending requests targeting this user (needs Accept/Decline)
    supabase
      .from("group_requests")
      .select(
        "id, course_id, request_type, created_at, updated_at, target_group_id, profiles!group_requests_requester_user_id_fkey(username), courses!group_requests_course_id_fkey(code, title)"
      )
      .eq("target_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .returns<RequestRow[]>(),

    // Outgoing requests this user sent that were accepted
    supabase
      .from("group_requests")
      .select(
        "id, course_id, request_type, created_at, updated_at, profiles!group_requests_target_user_id_fkey(username), courses!group_requests_course_id_fkey(code, title)"
      )
      .eq("requester_user_id", user.id)
      .eq("status", "accepted")
      .order("updated_at", { ascending: false })
      .limit(20)
      .returns<RequestRow[]>(),
    supabase
      .from("collab_session_invites")
      .select("id, created_at, profiles!collab_session_invites_inviter_user_id_fkey(username), courses!collab_session_invites_course_id_fkey(code, title)")
      .eq("target_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .returns<CollabInviteRow[]>(),
  ]);

  const incoming = incomingRaw ?? [];
  const accepted = acceptedRaw ?? [];
  const collabInvites = collabInvitesRaw ?? [];

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(42,32,40,0.45)] mb-1">Dashboard</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2a2028]">Notifications</h1>
        <p className="text-sm text-[rgba(42,32,40,0.45)] mt-1">Group requests and invite updates</p>
      </div>

      {incoming.length === 0 && accepted.length === 0 && collabInvites.length === 0 && (
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-10 text-center">
          <div className="text-4xl mb-3">🔔</div>
          <h2 className="text-base font-semibold text-[#2a2028] mb-1">All caught up</h2>
          <p className="text-sm text-[rgba(42,32,40,0.45)]">No new notifications right now.</p>
        </div>
      )}

      {collabInvites.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-[#2a2028]">Collaborative session invites</h2>
            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-xs font-bold">
              {collabInvites.length}
            </span>
          </div>
          <div className="space-y-3">
            {collabInvites.map((invite) => {
              const inviter = pickName(invite.profiles);
              const course = pickCourse(invite.courses);
              return (
                <div
                  key={invite.id}
                  className="bg-white rounded-2xl border border-[rgba(194,112,138,0.2)] p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c2708a] to-[#9b6ba5] text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {inviter.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#2a2028]">
                        <span className="font-semibold">{inviter}</span>
                        {" invited you to a collaborative session for "}
                        <span className="font-semibold text-[#c2708a]">{course.code || "a course"}</span>
                      </p>
                      {course.title && (
                        <p className="text-xs text-[rgba(42,32,40,0.45)] mt-0.5 truncate">{course.title}</p>
                      )}
                      <p className="text-xs text-[rgba(42,32,40,0.35)] mt-1">{timeAgo(invite.created_at)}</p>
                      <CollabInviteActions inviteId={invite.id} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Incoming — needs action */}
      {incoming.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-[#2a2028]">Needs your attention</h2>
            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-xs font-bold">
              {incoming.length}
            </span>
          </div>
          <div className="space-y-3">
            {incoming.map((req) => {
              const requester = pickName(req.profiles);
              const course = pickCourse(req.courses);
              return (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-[rgba(194,112,138,0.2)] p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c2708a] to-[#9b6ba5] text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {requester.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#2a2028]">
                        <span className="font-semibold">{requester}</span>
                        {" wants you to join their group for "}
                        <span className="font-semibold text-[#c2708a]">{course.code || "a course"}</span>
                      </p>
                      {course.title && (
                        <p className="text-xs text-[rgba(42,32,40,0.45)] mt-0.5 truncate">{course.title}</p>
                      )}
                      <p className="text-xs text-[rgba(42,32,40,0.35)] mt-1">{timeAgo(req.created_at)}</p>
                      <NotificationActions requestId={req.id} courseId={req.course_id} groupId={req.target_group_id ?? undefined} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Accepted — informational */}
      {accepted.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[#2a2028] mb-3">Invite accepted</h2>
          <div className="space-y-3">
            {accepted.map((req) => {
              const target = pickName(req.profiles);
              const course = pickCourse(req.courses);
              return (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[rgba(42,32,40,0.12)] text-[#2a2028] flex items-center justify-center text-sm font-bold shrink-0">
                      {target.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[#2a2028]">
                          <span className="font-semibold">{target}</span>
                          {" accepted your invite for "}
                          <span className="font-semibold text-[#c2708a]">{course.code || "a course"}</span>
                        </p>
                        {/* Checkmark badge */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c2708a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      {course.title && (
                        <p className="text-xs text-[rgba(42,32,40,0.45)] mt-0.5 truncate">{course.title}</p>
                      )}
                      <p className="text-xs text-[rgba(42,32,40,0.35)] mt-1">{timeAgo(req.updated_at)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
