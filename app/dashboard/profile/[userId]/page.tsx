import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BadgeIcon, BADGE_META, type BadgeLevel } from "@/app/dashboard/rewards/BadgeIcon";

type PointsRow = { course_id: number; points: number };
type BadgeRow  = { course_id: number; badge_level: number };
type EnrollRow = { course_id: number; courses: { id: number; code: string; title: string } | null };

function parseUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const targetId = parseUUID(userId);
  if (!targetId) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  // Redirect to own profile page for self
  if (user.id === targetId) redirect("/dashboard/profile");

  // Verify the viewer shares a group with the target (enforced by RLS too)
  const { count: sharedGroups } = await supabase
    .from("group_memberships")
    .select("group_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in(
      "group_id",
      (
        await supabase
          .from("group_memberships")
          .select("group_id")
          .eq("user_id", targetId)
      ).data?.map((r) => r.group_id) ?? []
    );

  if (!sharedGroups) notFound();

  const [profileRes, pointsRes, badgesRes, enrollRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, created_at, show_points")
      .eq("id", targetId)
      .maybeSingle(),
    supabase
      .from("user_course_points")
      .select("course_id, points")
      .eq("user_id", targetId)
      .returns<PointsRow[]>(),
    supabase
      .from("user_badges")
      .select("course_id, badge_level")
      .eq("user_id", targetId)
      .returns<BadgeRow[]>(),
    supabase
      .from("course_enrollments")
      .select("course_id, courses(id, code, title)")
      .eq("user_id", targetId)
      .returns<EnrollRow[]>(),
  ]);

  if (!profileRes.data) notFound();

  const profile     = profileRes.data;
  const showPoints  = profile.show_points !== false; // default true
  const username    = profile.username?.trim() || "Student";
  const initials    = username.split(" ").slice(0, 2).map((w: string) => w[0].toUpperCase()).join("");

  const courses = (enrollRes.data ?? [])
    .map((e) => e.courses)
    .filter(Boolean) as { id: number; code: string; title: string }[];

  const pointsMap = new Map((pointsRes.data ?? []).map((r) => [r.course_id, r.points]));
  const badgesMap = new Map<number, Set<number>>();
  for (const b of badgesRes.data ?? []) {
    if (!badgesMap.has(b.course_id)) badgesMap.set(b.course_id, new Set());
    badgesMap.get(b.course_id)!.add(b.badge_level);
  }

  const semesterTotal = courses.reduce((sum, c) => sum + (pointsMap.get(c.id) ?? 0), 0);
  const ccrCredits    = courses.filter((c) => (pointsMap.get(c.id) ?? 0) >= 1000).length;
  const totalBadges   = [...badgesMap.values()].reduce((s, set) => s + set.size, 0);

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(42,32,40,0.45)] mb-1">
          Profile
        </p>
        <h1 className="text-2xl font-bold text-[#2a2028]">{username}</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-6 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#c2708a] to-[#9b6ba5] text-white flex items-center justify-center text-xl font-bold shrink-0">
            {initials}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#2a2028]">{username}</h2>
            <p className="text-xs text-[rgba(42,32,40,0.35)] mt-1">
              Member since{" "}
              {new Date(profile.created_at).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats — only if show_points is on */}
      {showPoints ? (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Semester Points", value: semesterTotal.toLocaleString() },
            { label: "CCR Credits",     value: ccrCredits },
            { label: "Badges Earned",   value: totalBadges },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] p-4 shadow-sm text-center"
            >
              <p className="text-2xl font-bold bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] bg-clip-text text-transparent">
                {stat.value}
              </p>
              <p className="text-[10px] text-[rgba(42,32,40,0.5)] mt-1 font-medium leading-tight">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#f8f6f4] rounded-xl border border-[rgba(0,0,0,0.05)] p-4 text-center">
          <p className="text-xs text-[rgba(42,32,40,0.4)]">This member has hidden their points &amp; badges.</p>
        </div>
      )}

      {/* Per-course points & badges */}
      {showPoints && courses.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-[#2a2028]">Course Progress</p>
          {courses.map((course) => {
            const pts    = pointsMap.get(course.id) ?? 0;
            const earned = badgesMap.get(course.id) ?? new Set<number>();
            const pct    = Math.min((pts / 1000) * 100, 100);
            return (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-5 shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[11px] font-bold text-[rgba(42,32,40,0.4)] uppercase tracking-wider">
                      {course.code}
                    </p>
                    <p className="text-sm font-semibold text-[#2a2028] mt-0.5">{course.title}</p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="text-xl font-bold bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] bg-clip-text text-transparent">
                      {pts}
                    </p>
                    <p className="text-[10px] text-[rgba(42,32,40,0.4)]">/ 1000 pts</p>
                  </div>
                </div>

                <div className="h-2.5 bg-[#f2eeec] rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {([1, 2, 3, 4] as BadgeLevel[]).map((lvl) => {
                    const isEarned = earned.has(lvl);
                    return (
                      <div key={lvl} className="flex flex-col items-center gap-1">
                        <div
                          className={`w-12 h-12 ${isEarned ? "drop-shadow-sm" : "opacity-40"}`}
                          title={BADGE_META[lvl].name}
                        >
                          <BadgeIcon level={lvl} earned={isEarned} uid={`pub${targetId.slice(0,4)}c${course.id}b${lvl}`} />
                        </div>
                        <p className={`text-[9px] font-medium text-center ${isEarned ? "text-[#2a2028]" : "text-[rgba(42,32,40,0.3)]"}`}>
                          {BADGE_META[lvl].name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[10px] text-[rgba(42,32,40,0.3)] pb-4">
        Read-only view · Shared group member
      </p>
    </div>
  );
}
