import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "./Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let username = "Student";
  let notifCount = 0;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth");
    }

    const [{ data: profile }, { count: pendingCount }, { count: acceptedCount }] = await Promise.all([
      supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle<{ username: string }>(),
      supabase
        .from("group_requests")
        .select("id", { count: "exact", head: true })
        .eq("target_user_id", user.id)
        .eq("status", "pending"),
      supabase
        .from("group_requests")
        .select("id", { count: "exact", head: true })
        .eq("requester_user_id", user.id)
        .eq("status", "accepted")
        .gte("updated_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    username = profile?.username?.trim() || user.email?.split("@")[0] || "Student";
    notifCount = (pendingCount ?? 0) + (acceptedCount ?? 0);
  } catch {
    redirect("/auth");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f6f4]">
      <Sidebar username={username} notifCount={notifCount} />
      <div className="flex-1 ml-[240px] h-screen overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
