import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  username: string;
  onboarding_completed: boolean;
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const [profileRes, enrollmentsRes, membershipsRes] = await Promise.all([
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
  ]);

  const profile = profileRes.data;
  const coursesCount = enrollmentsRes.count ?? 0;
  const groupsCount = membershipsRes.count ?? 0;

  const username =
    profile?.username?.trim().length
      ? profile.username
      : user.email?.split("@")[0] ?? "Student";

  const initials = username
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w.charAt(0).toUpperCase())
    .join("");

  const stats = [
    { label: "Courses Enrolled", value: coursesCount },
    { label: "Study Groups", value: groupsCount },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(42,32,40,0.45)] mb-1">
          Profile
        </p>
        <h1 className="text-2xl font-bold text-[#2a2028]">My Profile</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-6 shadow-sm mb-6">
        <div className="flex items-center gap-5">
          {/* Avatar */}
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
      <div className="grid grid-cols-2 gap-4 mb-6">
        {stats.map((stat) => (
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
