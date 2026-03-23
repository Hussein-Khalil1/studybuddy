import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatBox } from "./ChatBox";
import { SyllabusBar } from "./SyllabusBar";

type MemberRow = {
  user_id: string;
  group_id: number;
  profiles: { username: string } | null;
};

type CourseRow = {
  id: number;
  code: string;
  title: string;
};

type MessageRow = {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
};

function parseNumericId(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const AVATAR_COLORS = ["bg-[#c2708a]", "bg-[#9b6ba5]", "bg-[#d4956a]", "bg-[rgba(42,32,40,0.4)]"];

export default async function GroupPage({
  params,
}: {
  params: Promise<{ courseId: string; groupId: string }>;
}) {
  const resolved = await params;
  const courseId = parseNumericId(resolved.courseId);
  const groupId = parseNumericId(resolved.groupId);

  if (!courseId || !groupId) redirect("/dashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const [{ data: enrollment }, { data: myMembership }, { data: course }, { data: membersRaw }, { data: messagesRaw }, { data: syllabusRaw }] =
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
      supabase
        .from("group_messages")
        .select("id, user_id, content, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(200)
        .returns<MessageRow[]>(),
      supabase
        .from("syllabi")
        .select("file_name, events_extracted, created_at, profiles!syllabi_uploaded_by_fkey(username)")
        .eq("group_id", groupId)
        .maybeSingle(),
    ]);

  if (!enrollment || !myMembership || !course) {
    redirect(`/dashboard/course/${courseId}`);
  }

  const members = (membersRaw ?? []).map((member) => ({
    id: member.user_id,
    username: member.profiles?.username?.trim() || "Student",
  }));

  const syllabusData = syllabusRaw as {
    file_name: string;
    events_extracted: number;
    created_at: string;
    profiles: { username: string } | null;
  } | null;

  const existingSyllabus = syllabusData
    ? {
        fileName:        syllabusData.file_name,
        eventsExtracted: syllabusData.events_extracted,
        uploadedAt:      syllabusData.created_at,
        uploaderName:    syllabusData.profiles?.username ?? "a member",
      }
    : null;

  const sortedMembers = [...members].sort((a, b) => a.username.localeCompare(b.username));

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>
      {/* Top bar */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-[rgba(0,0,0,0.07)]">
        {/* Back */}
        <Link
          href="/dashboard/messages"
          className="w-8 h-8 rounded-full hover:bg-[#f2eeec] flex items-center justify-center transition shrink-0"
          aria-label="Back to messages"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>

        {/* Group avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c2708a] to-[#9b6ba5] flex items-center justify-center text-white text-xs font-bold shrink-0">
          {course.code.slice(0, 3)}
        </div>

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#2a2028] truncate">
            {course.code} Study Group
          </p>
          <p className="text-xs text-[rgba(42,32,40,0.45)] truncate">{course.title}</p>
        </div>

        {/* Member avatars */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex -space-x-1.5">
            {sortedMembers.slice(0, 4).map((member, idx) => (
              <Link
                key={member.id}
                href={member.id === user.id ? "/dashboard/profile" : `/dashboard/profile/${member.id}`}
                title={member.id === user.id ? `${member.username} (you)` : member.username}
                className={`w-7 h-7 rounded-full ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} text-white flex items-center justify-center text-xs font-bold border-2 border-white hover:opacity-80 transition-opacity`}
              >
                {member.username.charAt(0).toUpperCase()}
              </Link>
            ))}
            {sortedMembers.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-[rgba(42,32,40,0.1)] text-[#2a2028] flex items-center justify-center text-xs font-bold border-2 border-white">
                +{sortedMembers.length - 4}
              </div>
            )}
          </div>
          <span className="text-xs text-[rgba(42,32,40,0.45)] hidden sm:block">
            {sortedMembers.length} member{sortedMembers.length !== 1 ? "s" : ""}
          </span>
        </div>
      </header>

      {/* Syllabus bar */}
      <SyllabusBar groupId={groupId} courseId={courseId} existing={existingSyllabus} />

      {/* Chat — fills remaining height */}
      <ChatBox
        groupId={groupId}
        currentUserId={user.id}
        initialMessages={messagesRaw ?? []}
        members={members}
      />
    </div>
  );
}
