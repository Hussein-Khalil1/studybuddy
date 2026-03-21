import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BadgeIcon, BADGE_META, type BadgeLevel } from "./BadgeIcon";

type EnrollmentRow = {
  course_id: number;
  courses: { id: number; code: string; title: string } | null;
};

type PointsRow      = { course_id: number; points: number };
type BadgeRow       = { course_id: number; badge_level: number; earned_at: string };
type MembershipRow  = { group_id: number; course_id: number };
type MsgRow         = { group_id: number };

const THRESHOLDS = [250, 500, 750, 1000] as const;
const MESSAGE_MILESTONE = 500;

export default async function RewardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [enrollRes, pointsRes, badgesRes, membershipsRes, userMsgsRes] = await Promise.all([
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
  ]);

  const courses = (enrollRes.data ?? [])
    .map((e) => e.courses)
    .filter(Boolean) as { id: number; code: string; title: string }[];

  const pointsMap = new Map((pointsRes.data ?? []).map((r) => [r.course_id, r.points]));

  const badgesMap = new Map<number, Set<number>>();
  for (const b of badgesRes.data ?? []) {
    if (!badgesMap.has(b.course_id)) badgesMap.set(b.course_id, new Set());
    badgesMap.get(b.course_id)!.add(b.badge_level);
  }

  // Build per-course message counts
  const groupCourseMap = new Map((membershipsRes.data ?? []).map((m) => [m.group_id, m.course_id]));
  const msgCountByCourse = new Map<number, number>();
  for (const msg of userMsgsRes.data ?? []) {
    const courseId = groupCourseMap.get(msg.group_id);
    if (courseId !== undefined) {
      msgCountByCourse.set(courseId, (msgCountByCourse.get(courseId) ?? 0) + 1);
    }
  }

  const semesterTotal = courses.reduce((sum, c) => sum + (pointsMap.get(c.id) ?? 0), 0);
  const ccrCredits      = courses.filter((c) => (pointsMap.get(c.id) ?? 0) >= 1000).length;
  const ccrCap          = Math.min(3, courses.length);

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(42,32,40,0.45)] mb-1">
          Rewards
        </p>
        <h1 className="text-2xl font-bold text-[#2a2028]">Badges &amp; Points</h1>
      </div>

      {/* ── Semester overview card ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#c2708a] to-[#9b6ba5] rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-4 w-48 h-48 rounded-full bg-white/5" />

        <p className="relative text-xs font-semibold uppercase tracking-widest opacity-70 mb-5">
          Semester Overview
        </p>

        {/* Per-course breakdown */}
        {courses.length > 0 && (
          <div className="relative space-y-3 mb-5">
            {courses.slice(0, 3).map((course) => {
              const pts = pointsMap.get(course.id) ?? 0;
              const pct = Math.min((pts / 1000) * 100, 100);
              return (
                <div key={course.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold opacity-80 tracking-wide">{course.code}</span>
                    <span className="text-xs font-bold tabular-nums">{pts} / 1,000</span>
                  </div>
                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/80 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div className="relative border-t border-white/20 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-3xl font-bold tracking-tight">{semesterTotal.toLocaleString()}</p>
              <p className="text-xs opacity-65 mt-0.5">
                total of {(Math.min(courses.length, 3) * 1000).toLocaleString()} max pts
              </p>
            </div>
            <div className="sm:text-right">
              <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-70">CCR Credits</span>
                  <span className="text-lg font-bold">{ccrCredits} / {ccrCap}</span>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: ccrCap }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded-full border-2 border-white/60 flex items-center justify-center text-[10px] font-bold transition-colors ${
                        i < ccrCredits ? "bg-white text-[#9b6ba5]" : "bg-white/10"
                      }`}
                    >
                      {i < ccrCredits ? "✓" : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Per-course cards ── */}
      {courses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-10 text-center shadow-sm">
          <p className="text-3xl mb-3">📚</p>
          <p className="text-sm font-medium text-[#2a2028]">No courses enrolled yet</p>
          <p className="text-xs text-[rgba(42,32,40,0.45)] mt-1">
            Enroll in courses to start earning points and badges.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {courses.map((course) => {
            const pts     = pointsMap.get(course.id) ?? 0;
            const earned  = badgesMap.get(course.id) ?? new Set<number>();
            const pct     = Math.min((pts / 1000) * 100, 100);
            const nextThreshold = THRESHOLDS.find((t) => pts < t);

            return (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-5 shadow-sm"
              >
                {/* Course header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[11px] font-bold text-[rgba(42,32,40,0.4)] uppercase tracking-wider">
                      {course.code}
                    </p>
                    <p className="text-sm font-semibold text-[#2a2028] mt-0.5 leading-snug max-w-xs">
                      {course.title}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-2xl font-bold bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] bg-clip-text text-transparent">
                      {pts}
                    </p>
                    <p className="text-[10px] text-[rgba(42,32,40,0.4)] -mt-0.5">/ 1000 pts</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="relative h-3 bg-[#f2eeec] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                    {[25, 50, 75].map((m) => (
                      <div
                        key={m}
                        className="absolute inset-y-0 w-px bg-white/50"
                        style={{ left: `${m}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1 px-px">
                    {THRESHOLDS.map((t) => (
                      <span
                        key={t}
                        className={`text-[9px] font-semibold tabular-nums ${
                          pts >= t ? "text-[#9b6ba5]" : "text-[rgba(42,32,40,0.28)]"
                        }`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {nextThreshold && (
                  <p className="text-[10px] text-[rgba(42,32,40,0.4)] mb-4">
                    {nextThreshold - pts} pts to next badge
                  </p>
                )}
                {!nextThreshold && (
                  <p className="text-[10px] text-[#9b6ba5] font-semibold mb-4">
                    ✦ All badges unlocked — CCR Credit Earned!
                  </p>
                )}

                {/* Badge row */}
                <div className="grid grid-cols-4 gap-2 sm:gap-4">
                  {([1, 2, 3, 4] as BadgeLevel[]).map((lvl) => {
                    const meta     = BADGE_META[lvl];
                    const isEarned = earned.has(lvl);
                    return (
                      <div key={lvl} className="flex flex-col items-center gap-1">
                        <div
                          className={`w-14 h-14 sm:w-16 sm:h-16 transition-transform duration-200 ${
                            isEarned ? "drop-shadow-md hover:scale-110 cursor-default" : "opacity-50"
                          }`}
                          title={
                            isEarned
                              ? `${meta.name} — ${meta.tagline}`
                              : `Locked · reach ${meta.points} pts`
                          }
                        >
                          <BadgeIcon level={lvl} earned={isEarned} uid={`c${course.id}b${lvl}`} />
                        </div>
                        <p
                          className={`text-[9px] sm:text-[10px] font-semibold text-center leading-tight ${
                            isEarned ? "text-[#2a2028]" : "text-[rgba(42,32,40,0.3)]"
                          }`}
                        >
                          {meta.name}
                        </p>
                        <p
                          className={`text-[8px] sm:text-[9px] text-center ${
                            isEarned ? "text-[#9b6ba5] font-medium" : "text-[rgba(42,32,40,0.25)]"
                          }`}
                        >
                          {isEarned ? "Earned ✓" : `${meta.points} pts`}
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

      {/* ── Platform milestones ── */}
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-5 shadow-sm">
        <p className="text-sm font-semibold text-[#2a2028] mb-5">Platform Milestones</p>
        <div className="space-y-5">

          {/* Messages milestone — per course */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#f2eeec] flex items-center justify-center text-base shrink-0">
                💬
              </div>
              <div>
                <p className="text-xs font-semibold text-[#2a2028]">500 Messages Sent</p>
                <p className="text-[10px] text-[rgba(42,32,40,0.45)]">Awards 250 pts · Per course</p>
              </div>
            </div>
            <div className="space-y-2.5 pl-1">
              {courses.length === 0 && (
                <p className="text-xs text-[rgba(42,32,40,0.35)]">Enroll in a course to track messages.</p>
              )}
              {courses.map((course) => {
                const count     = msgCountByCourse.get(course.id) ?? 0;
                const reached   = count >= MESSAGE_MILESTONE;
                const pct       = Math.min((count / MESSAGE_MILESTONE) * 100, 100);
                return (
                  <div key={course.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-semibold ${reached ? "text-[#9b6ba5]" : "text-[rgba(42,32,40,0.55)]"}`}>
                        {course.code} {reached && "✓"}
                      </span>
                      <span className={`text-[10px] tabular-nums font-medium ${reached ? "text-[#9b6ba5]" : "text-[rgba(42,32,40,0.4)]"}`}>
                        {Math.min(count, MESSAGE_MILESTONE)} / {MESSAGE_MILESTONE}
                      </span>
                    </div>
                    <div className="h-2 bg-[#f2eeec] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          reached
                            ? "bg-gradient-to-r from-[#c2708a] to-[#9b6ba5]"
                            : "bg-gradient-to-r from-[#d4956a] to-[#c2708a]"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming milestones */}
          {[
            { icon: "📋", label: "Complete 5 Surveys",          sub: "Awards 100 pts" },
            { icon: "⭐", label: "Receive 10/10 Rating",        sub: "Awards 100 pts" },
            { icon: "🎥", label: "10 Video Calls (60+ min)",    sub: "Awards 250 pts per course" },
            { icon: "🤝", label: "20 hrs Collaborative Study",  sub: "Awards 100 pts per member" },
          ].map(({ icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3 opacity-40">
              <div className="w-9 h-9 rounded-xl bg-[#f2eeec] flex items-center justify-center text-base shrink-0">
                {icon}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-[#2a2028]">{label}</p>
                <p className="text-[10px] text-[rgba(42,32,40,0.45)]">{sub}</p>
              </div>
              <span className="text-[10px] text-[rgba(42,32,40,0.4)] font-medium whitespace-nowrap">
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
