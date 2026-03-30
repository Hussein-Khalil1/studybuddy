import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RewardsClient from "./RewardsClient";

type EnrollmentRow = {
  course_id: number;
  courses: { id: number; code: string; title: string } | null;
};

type PointsRow     = { course_id: number; points: number };
type BadgeRow      = { course_id: number; badge_level: number; earned_at: string };
type MembershipRow = { group_id: number; course_id: number };
type MsgRow        = { group_id: number };
type PointEventRow = { course_id: number; source: string; points: number; created_at: string };

export default async function RewardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [enrollRes, pointsRes, badgesRes, membershipsRes, userMsgsRes, eventsRes] = await Promise.all([
    supabase
      .from("course_enrollments")
      .select("course_id, courses(id, code, title)")
      .eq("user_id", user.id)
      .returns<EnrollmentRow[]>(),
    supabase
      .from("user_course_points")
      .select("course_id, points")
      .eq("user_id", user.id)
      .returns<PointsRow[]>(),
    supabase
      .from("user_badges")
      .select("course_id, badge_level, earned_at")
      .eq("user_id", user.id)
      .returns<BadgeRow[]>(),
    supabase
      .from("group_memberships")
      .select("group_id, course_id")
      .eq("user_id", user.id)
      .returns<MembershipRow[]>(),
    supabase
      .from("group_messages")
      .select("group_id")
      .eq("user_id", user.id)
      .returns<MsgRow[]>(),
    supabase
      .from("point_events")
      .select("course_id, source, points, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<PointEventRow[]>(),
  ]);

  const courses = (enrollRes.data ?? [])
    .map((e) => e.courses)
    .filter(Boolean) as { id: number; code: string; title: string }[];

  const groupCourseMap = new Map((membershipsRes.data ?? []).map((m) => [m.group_id, m.course_id]));
  const msgCountByCourse = new Map<number, number>();
  for (const msg of userMsgsRes.data ?? []) {
    const courseId = groupCourseMap.get(msg.group_id);
    if (courseId !== undefined) {
      msgCountByCourse.set(courseId, (msgCountByCourse.get(courseId) ?? 0) + 1);
    }
  }

  const msgCountObj = Object.fromEntries(msgCountByCourse.entries());

  return (
    <RewardsClient
      userId={user.id}
      courses={courses}
      initialPoints={pointsRes.data ?? []}
      initialBadges={badgesRes.data ?? []}
      initialEvents={eventsRes.data ?? []}
      msgCountByCourse={msgCountObj}
    />
  );
}
