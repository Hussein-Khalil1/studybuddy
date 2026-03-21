import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type MembershipRow = {
  group_id: number;
  course_id: number;
};

type CourseRow = {
  id: number;
  code: string;
};

type AssignmentRow = {
  id: number;
  title: string;
  due_date: string | null;
  course_id: number;
  group_id: number;
};

function getDueDateStatus(dueDate: string): "overdue" | "soon" | "normal" {
  const due = new Date(dueDate + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffMs = dueDay.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays < 7) return "soon";
  return "normal";
}

function formatDueDate(dueDate: string): string {
  return new Date(dueDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getMonthLabel(dueDate: string): string {
  return new Date(dueDate + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const myGroups = rawMemberships.map((row) => ({
    group_id: row.group_id,
    course_id: row.course_id,
    course_code: courseMap.get(row.course_id) ?? "",
  }));

  const groupIds = myGroups.map((g) => g.group_id);

  let assignments: (AssignmentRow & { course_code: string })[] = [];

  if (groupIds.length > 0) {
    const { data: rows } = await supabase
      .from("assignments")
      .select("id, title, due_date, course_id, group_id")
      .in("group_id", groupIds)
      .order("due_date", { ascending: true, nullsFirst: false })
      .returns<AssignmentRow[]>();

    assignments = (rows ?? []).map((a) => {
      const group = myGroups.find((g) => g.group_id === a.group_id);
      return { ...a, course_code: group?.course_code ?? "" };
    });
  }

  const withDueDates = assignments.filter((a) => a.due_date !== null);
  const noDueDates = assignments.filter((a) => a.due_date === null);

  // Group assignments by month
  const byMonth = new Map<string, typeof withDueDates>();
  for (const a of withDueDates) {
    const month = getMonthLabel(a.due_date!);
    const existing = byMonth.get(month) ?? [];
    existing.push(a);
    byMonth.set(month, existing);
  }

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(42,32,40,0.45)] mb-1">
          Calendar
        </p>
        <h1 className="text-2xl font-bold text-[#2a2028]">Upcoming Due Dates</h1>
        <p className="text-sm text-[rgba(42,32,40,0.45)] mt-1">
          Stay on top of your group assignments.
        </p>
      </div>

      {/* Empty state */}
      {assignments.length === 0 && (
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-8 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h2 className="text-lg font-semibold text-[#2a2028] mb-2">No assignments yet</h2>
          <p className="text-sm text-[rgba(42,32,40,0.45)]">
            Assignments added by your study groups will appear here.
          </p>
        </div>
      )}

      {/* Assignments by month */}
      {byMonth.size > 0 && (
        <div className="space-y-8">
          {Array.from(byMonth.entries()).map(([month, monthAssignments]) => (
            <div key={month}>
              <h2 className="text-sm font-semibold text-[rgba(42,32,40,0.55)] uppercase tracking-wider mb-3">
                {month}
              </h2>
              <div className="space-y-3">
                {monthAssignments.map((assignment) => {
                  const status = getDueDateStatus(assignment.due_date!);
                  return (
                    <div
                      key={assignment.id}
                      className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] p-4 shadow-sm flex items-start gap-4"
                    >
                      {/* Status indicator */}
                      <div
                        className={`w-1 self-stretch rounded-full shrink-0 ${
                          status === "overdue"
                            ? "bg-red-400"
                            : status === "soon"
                            ? "bg-amber-400"
                            : "bg-gradient-to-b from-[#c2708a] to-[#9b6ba5]"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-semibold text-[#c2708a] bg-[rgba(194,112,138,0.1)] px-2 py-0.5 rounded-full">
                            {assignment.course_code}
                          </span>
                          {status === "overdue" && (
                            <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                              Overdue
                            </span>
                          )}
                          {status === "soon" && (
                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              Due soon
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-[#2a2028]">{assignment.title}</p>
                        <p className="text-xs text-[rgba(42,32,40,0.45)] mt-0.5">
                          {formatDueDate(assignment.due_date!)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No due date section */}
      {noDueDates.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-[rgba(42,32,40,0.55)] uppercase tracking-wider mb-3">
            No Due Date
          </h2>
          <div className="space-y-3">
            {noDueDates.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] p-4 shadow-sm flex items-start gap-4"
              >
                <div className="w-1 self-stretch rounded-full shrink-0 bg-[rgba(0,0,0,0.1)]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-[#c2708a] bg-[rgba(194,112,138,0.1)] px-2 py-0.5 rounded-full">
                      {assignment.course_code}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#2a2028]">{assignment.title}</p>
                  <p className="text-xs text-[rgba(42,32,40,0.35)] mt-0.5">No due date set</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
