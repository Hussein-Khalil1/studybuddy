"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addAssignmentAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const title = formData.get("title");
  const groupId = parseInt(formData.get("group_id") as string, 10);
  const dueDateRaw = formData.get("due_date");

  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("Title is required.");
  }
  if (!Number.isFinite(groupId)) {
    throw new Error("Invalid group.");
  }

  const { data: membership } = await supabase
    .from("group_memberships")
    .select("course_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle<{ course_id: number }>();

  if (!membership) throw new Error("You are not a member of this group.");

  const { error } = await supabase.from("assignments").insert({
    title: title.trim(),
    course_id: membership.course_id,
    group_id: groupId,
    due_date: (typeof dueDateRaw === "string" && dueDateRaw) ? dueDateRaw : null,
    created_by: user.id,
  });

  if (error) throw error;
  revalidatePath("/dashboard");
}

export async function upsertProgressAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const assignmentId = parseInt(formData.get("assignment_id") as string, 10);
  const progress = parseInt(formData.get("progress") as string, 10);
  const note = formData.get("note");

  if (!Number.isFinite(assignmentId) || !Number.isFinite(progress)) {
    throw new Error("Invalid form data.");
  }

  const { error } = await supabase.from("assignment_progress").upsert(
    {
      assignment_id: assignmentId,
      user_id: user.id,
      progress,
      note: (typeof note === "string" && note.trim()) ? note.trim() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,user_id" }
  );

  if (error) throw error;
  revalidatePath("/dashboard");
}
