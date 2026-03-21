import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BadgeIcon, BADGE_META, type BadgeLevel } from "@/app/dashboard/rewards/BadgeIcon";

type ProfileRow = {
  username: string;
  onboarding_completed: boolean;
};

type PointsRow = { course_id: number; points: number };
type BadgeRow  = { course_id: number; badge_level: number };
type EnrollRow = { course_id: number; courses: { id: number; code: string; title: string } | null };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [profileRes, enrollmentsRes, membershipsRes, pointsRes, badgesRes, enrollCoursesRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("username, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>(),
      supabase
        .from("course_enrollments")
        .select("course_id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("group_memberships")
        .select("group_id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("user_course_points")
        .select("course_id, points")
        .eq("user_id", user.id)
        .returns<PointsRow[]>(),
      supabase
        .from("user_badges")
        .select("course_id, badge_level")
        .eq("user_id", user.id)
        .returns<BadgeRow[]>(),
      supabase
        .from("course_enrollments")
        .select("course_id, courses(id, code, title)")
        .eq("user_id", user.id)
        .returns<EnrollRow[]>(),
    ]);

  const profile      = profileRes.data;
  const coursesCount = enrollmentsRes.count ?? 0;
  const groupsCount  = membershipsRes.count ?? 0;

  const username = profile?.username?.trim().length
    ? profile.username
    : user.email?.split("@")[0] ?? "Student";

  const initials = username
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w.charAt(0).toUpperCase())
    .join("");

  const courses   = (enrollCoursesRes.data ?? []).map((e) => e.courses).filter(Boolean) as { id: number; code: string; title: string }[];
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
        <h1 className="text-2xl font-bold text-[#2a2028]">My Profile</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-6 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#c2708a] to-[#9b6ba5] text-white flex items-center justify-center text-xl font-bold shrink-0">
            {initials}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#2a2028]">{username}</h2>
            <p className="text-sm text-[rgba(42,32,40,0.45)] mt-0.5">{user.email}</p>
            <p className="text-xs text-[rgba(42,32,40,0.35)] mt-1">
              Member since{" "}
              {new Date(user.created_at).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Courses Enrolled", value: coursesCount },
          { label: "Study Groups",     value: groupsCount  },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] p-5 shadow-sm text-center"
          >
            <p className="text-3xl font-bold bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] bg-clip-text text-transparent">
              {stat.value}
            </p>
            <p className="text-xs text-[rgba(42,32,40,0.55)] mt-1 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Rewards summary ── */}
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm font-semibold text-[#2a2028]">Rewards &amp; Badges</p>
          <Link
            href="/dashboard/rewards"
            className="text-xs font-semibold text-[#9b6ba5] hover:underline"
          >
            View all →
          </Link>
        </div>

        {/* Semester summary numbers */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Semester Points", value: semesterTotal.toLocaleString() },
            { label: "CCR Credits",     value: ccrCredits },
            { label: "Badges Earned",   value: totalBadges },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-[#f8f6f4] rounded-xl p-3 text-center border border-[rgba(0,0,0,0.04)]"
            >
              <p className="text-xl font-bold bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] bg-clip-text text-transparent">
                {s.value}
              </p>
              <p className="text-[10px] text-[rgba(42,32,40,0.5)] mt-0.5 font-medium leading-tight">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Earned badge icons */}
        {totalBadges === 0 ? (
          <div className="text-center py-3">
            <p className="text-xs text-[rgba(42,32,40,0.4)]">No badges yet — keep studying to earn your first!</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {courses.flatMap((course) =>
              ([1, 2, 3, 4] as BadgeLevel[])
                .filter((lvl) => badgesMap.get(course.id)?.has(lvl))
                .map((lvl) => (
                  <div
                    key={`${course.id}-${lvl}`}
                    className="flex flex-col items-center gap-1"
                    title={`${BADGE_META[lvl].name} · ${course.code}`}
                  >
                    <div className="w-12 h-12 drop-shadow-sm hover:scale-110 transition-transform duration-150">
                      <BadgeIcon level={lvl} earned uid={`prof${course.id}b${lvl}`} />
                    </div>
                    <p className="text-[9px] text-[rgba(42,32,40,0.45)] font-medium">{course.code}</p>
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      {/* Account info */}
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#2a2028] mb-4">Account Details</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-[rgba(0,0,0,0.05)]">
            <span className="text-sm text-[rgba(42,32,40,0.55)]">Username</span>
            <span className="text-sm font-medium text-[#2a2028]">{username}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-[rgba(0,0,0,0.05)]">
            <span className="text-sm text-[rgba(42,32,40,0.55)]">Email</span>
            <span className="text-sm font-medium text-[#2a2028]">{user.email}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-[rgba(42,32,40,0.55)]">Onboarding</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                profile?.onboarding_completed
                  ? "text-emerald-700 bg-emerald-50"
                  : "text-amber-700 bg-amber-50"
              }`}
            >
              {profile?.onboarding_completed ? "Complete" : "Incomplete"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
