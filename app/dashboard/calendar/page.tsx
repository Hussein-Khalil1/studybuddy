import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarClient } from "./CalendarClient";

type MembershipRow = { group_id: number; course_id: number };
type CourseRow     = { id: number; code: string };
type AssignmentRow = { id: number; title: string; due_date: string | null; course_id: number; group_id: number; event_type?: string; prep_date?: string | null; is_flagged?: boolean };

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: membershipRows } = await supabase
    .from("group_memberships")
    .select("group_id, course_id")
    .eq("user_id", user.id)
    .returns<MembershipRow[]>();

  const rawMemberships = membershipRows ?? [];
  const courseIds = [...new Set(rawMemberships.map((r) => r.course_id))];

  const { data: courseRows } = courseIds.length > 0
    ? await supabase.from("courses").select("id, code").in("id", courseIds).returns<CourseRow[]>()
    : { data: [] as CourseRow[] };

  const courseMap = new Map((courseRows ?? []).map((c) => [c.id, c.code]));
  const myGroups  = rawMemberships.map((r) => ({
    group_id:    r.group_id,
    course_id:   r.course_id,
    course_code: courseMap.get(r.course_id) ?? "",
  }));

  const groupIds = myGroups.map((g) => g.group_id);

  let assignments: import("./CalendarClient").CalendarAssignment[] = [];

  if (groupIds.length > 0) {
    const { data: rows } = await supabase
      .from("assignments")
      .select("id, title, due_date, course_id, group_id, event_type, prep_date, is_flagged")
      .in("group_id", groupIds)
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<AssignmentRow[]>();

    assignments = (rows ?? []).map((a) => ({
      id:          a.id,
      title:       a.title,
      due_date:    a.due_date,
      course_code: myGroups.find((g) => g.group_id === a.group_id)?.course_code ?? "",
      event_type:  a.event_type ?? "assignment",
      prep_date:   a.prep_date ?? null,
      is_flagged:  a.is_flagged ?? false,
    }));
  }

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(42,32,40,0.45)] mb-1">
          Calendar
        </p>
        <h1 className="text-2xl font-bold text-[#2a2028]">Calendar</h1>
      </div>
      <CalendarClient assignments={assignments} />
    </div>
  );
}
