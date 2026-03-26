import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProgressWidget from "./ProgressWidget";
import MessagesWidget from "./MessagesWidget";
import StudySessionWidget from "./StudySessionWidget";

type ProfileRow = {
  username: string;
  onboarding_completed: boolean;
};

type MembershipRow = {
  group_id: number;
  course_id: number;
};

type CourseRow = {
  id: number;
  code: string;
  title: string;
};

type EnrollmentRow = {
  course_id: number;
  courses: CourseRow | CourseRow[];
};

type AssignmentRow = {
  id: number;
  title: string;
  due_date: string | null;
  course_id: number;
  group_id: number;
};

type ProgressRow = {
  assignment_id: number;
  user_id: string;
  progress: number;
  note: string | null;
  profiles: { username: string } | { username: string }[];
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

export default async function DashboardPage() {
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

  // Fetch memberships then courses separately (no direct FK from group_memberships.course_id to courses)
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

  const { data: enrollmentRows } = await supabase
    .from("course_enrollments")
    .select("course_id, courses!inner(id, code, title)")
    .eq("user_id", user.id)
    .returns<EnrollmentRow[]>();

  const enrolledCourses = (enrollmentRows ?? [])
    .map((row) => {
      const c = row.courses;
      const course = Array.isArray(c) ? c[0] : c;
      if (!course) return null;
      return course;
    })
    .filter((course): course is CourseRow => Boolean(course));

  let assignmentRows: AssignmentRow[] | null = null;
  let progressRows: ProgressRow[] | null = null;
  let memberRows: GroupMemberRow[] | null = null;
  let messageRows: MessageRow[] | null = null;

  if (groupIds.length > 0) {
    const [assignmentsRes, membersRes, messagesRes] = await Promise.all([
      supabase
        .from("assignments")
        .select("id, title, due_date, course_id, group_id")
        .in("group_id", groupIds)
        .order("due_date", { ascending: true, nullsFirst: false })
        .returns<AssignmentRow[]>(),
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

    assignmentRows = assignmentsRes.data;
    memberRows = membersRes.data;
    messageRows = messagesRes.data;

    const assignmentIds = (assignmentRows ?? []).map((a) => a.id);
    if (assignmentIds.length > 0) {
      const { data: progData } = await supabase
        .from("assignment_progress")
        .select("assignment_id, user_id, progress, note, profiles!assignment_progress_user_id_fkey(username)")
        .in("assignment_id", assignmentIds)
        .returns<ProgressRow[]>();
      progressRows = progData;
    }
  }

  // Build processed assignments
  const processedAssignments = (assignmentRows ?? []).map((a) => {
    const courseInfo = myGroups.find((g) => g.group_id === a.group_id);
    const groupMembers = (memberRows ?? []).filter((m) => m.group_id === a.group_id);
    const members = groupMembers.map((m) => {
      const prog = (progressRows ?? []).find(
        (p) => p.assignment_id === a.id && p.user_id === m.user_id
      );
      return {
        user_id: m.user_id,
        username: pickName(m.profiles),
        progress: prog?.progress ?? null,
        note: prog?.note ?? null,
      };
    });
    return {
      id: a.id,
      title: a.title,
      due_date: a.due_date,
      course_id: a.course_id,
      group_id: a.group_id,
      course_code: courseInfo?.course_code ?? "",
      members,
    };
  });

  // Build processed group messages
  const processedGroups = myGroups.map((g) => {
    const groupMembers = (memberRows ?? [])
      .filter((m) => m.group_id === g.group_id)
      .map((m) => ({ user_id: m.user_id, username: pickName(m.profiles) }));

    const lastMsg = (messageRows ?? []).find((m) => m.group_id === g.group_id);
    return {
      group_id: g.group_id,
      course_id: g.course_id,
      course_code: g.course_code,
      last_message: lastMsg
        ? {
            content: lastMsg.content,
            sender: pickName(lastMsg.profiles),
            sender_id: lastMsg.user_id,
            created_at: lastMsg.created_at,
          }
        : null,
      members: groupMembers,
    };
  });

  const username =
    profile.username?.trim().length > 0
      ? profile.username
      : user.email?.split("@")[0] ?? "Student";

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(42,32,40,0.45)] mb-1">
          Dashboard
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2a2028]">
          Welcome back, {username} 👋
        </h1>
        <p className="text-sm text-[rgba(42,32,40,0.45)] mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          {myGroups.length > 0 &&
            ` · ${myGroups.length} active group${myGroups.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      <div className="space-y-6">
        <StudySessionWidget courses={enrolledCourses} />

        {/* Empty state: no groups */}
      {myGroups.length === 0 && (
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-8 text-center">
          <div className="text-4xl mb-3">🎓</div>
          <h2 className="text-lg font-semibold text-[#2a2028] mb-2">No groups yet</h2>
          <p className="text-sm text-[rgba(42,32,40,0.45)] mb-4">
            Join a study group to start tracking progress and messaging.
          </p>
          <Link
            href="/dashboard/courses"
            className="inline-flex px-4 py-2 rounded-xl bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-sm font-medium hover:opacity-90 transition"
          >
            Go to Courses →
          </Link>
        </div>
      )}

      {/* Main grid */}
      {myGroups.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Progress section */}
          <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-5 shadow-sm">
            <ProgressWidget
              assignments={processedAssignments}
              groups={myGroups.map((g) => ({
                group_id: g.group_id,
                course_code: g.course_code,
                course_title: g.course_title,
              }))}
              currentUserId={user.id}
            />
          </div>

          {/* Messages section */}
          <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-5 shadow-sm">
            <MessagesWidget groups={processedGroups} currentUserId={user.id} />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
