import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrivacyToggle } from "./PrivacyToggle";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, show_points")
    .eq("id", user.id)
    .maybeSingle<{ username: string; show_points: boolean }>();

  const currentUsername = profile?.username?.trim() || user.email?.split("@")[0] || "Student";
  const showPoints = profile?.show_points ?? true;

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(42,32,40,0.45)] mb-1">
          Settings
        </p>
        <h1 className="text-2xl font-bold text-[#2a2028]">Settings</h1>
        <p className="text-sm text-[rgba(42,32,40,0.45)] mt-1">
          Manage your account preferences.
        </p>
      </div>

      {/* Profile settings */}
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-6 shadow-sm mb-6">
        <h2 className="text-base font-semibold text-[#2a2028] mb-1">Profile</h2>
        <p className="text-xs text-[rgba(42,32,40,0.45)] mb-5">Update your display name.</p>

        <form className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-medium text-[rgba(42,32,40,0.65)] mb-1.5"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              defaultValue={currentUsername}
              maxLength={50}
              className="w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.1)] text-sm text-[#2a2028] bg-[#f8f6f4] focus:outline-none focus:border-[#c2708a] transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-[rgba(42,32,40,0.65)] mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={user.email ?? ""}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.07)] text-sm text-[rgba(42,32,40,0.45)] bg-[#f2eeec] cursor-not-allowed"
            />
            <p className="text-xs text-[rgba(42,32,40,0.35)] mt-1">
              Email cannot be changed here.
            </p>
          </div>
          <button
            type="button"
            disabled
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-sm font-medium opacity-50 cursor-not-allowed"
            title="Coming soon"
          >
            Save Changes
          </button>
        </form>
      </div>

      {/* Privacy */}
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-6 shadow-sm mb-6">
        <h2 className="text-base font-semibold text-[#2a2028] mb-1">Privacy</h2>
        <p className="text-xs text-[rgba(42,32,40,0.45)] mb-5">
          Control what group members can see on your profile.
        </p>
        <PrivacyToggle initialValue={showPoints} />
      </div>

      {/* Notifications stub */}
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-6 shadow-sm mb-6">
        <h2 className="text-base font-semibold text-[#2a2028] mb-1">Notifications</h2>
        <p className="text-xs text-[rgba(42,32,40,0.45)] mb-5">
          Notification preferences coming soon.
        </p>
        <div className="space-y-3 opacity-50 pointer-events-none">
          {["New group invites", "New messages", "Assignment reminders"].map((label) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm text-[#2a2028]">{label}</span>
              <div className="w-10 h-5 rounded-full bg-[rgba(0,0,0,0.1)] relative">
                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone stub */}
      <div className="bg-white rounded-2xl border border-red-100 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-red-600 mb-1">Danger Zone</h2>
        <p className="text-xs text-[rgba(42,32,40,0.45)] mb-4">
          Irreversible actions for your account.
        </p>
        <button
          type="button"
          disabled
          className="px-4 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-400 cursor-not-allowed"
          title="Coming soon"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
