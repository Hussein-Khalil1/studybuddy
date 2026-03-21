"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("profiles")
        .update({ is_online: false })
        .eq("id", user.id);
    }

    await supabase.auth.signOut();
  } finally {
    redirect("/");
  }
}

function parseId(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function sendGroupRequestAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const courseId = parseId(formData.get("courseId"));
  const targetUserId = formData.get("targetUserId");
  const targetGroupId = parseId(formData.get("targetGroupId"));
  const requestType = formData.get("requestType");

  if (
    !courseId ||
    typeof targetUserId !== "string" ||
    targetUserId.length === 0 ||
    (requestType !== "create_group" && requestType !== "join_group")
  ) {
    throw new Error("Invalid request payload.");
  }

  if (user.id === targetUserId) {
    throw new Error("You cannot send a request to yourself.");
  }

  const { data: meEnrollment } = await supabase
    .from("course_enrollments")
    .select("course_id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();

  const { data: targetEnrollment } = await supabase
    .from("course_enrollments")
    .select("course_id")
    .eq("user_id", targetUserId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!meEnrollment || !targetEnrollment) {
    throw new Error("Both students must be enrolled in this course.");
  }

  if (requestType === "join_group") {
    if (!targetGroupId) {
      throw new Error("Target group is required for join requests.");
    }

    const { data: targetMembership } = await supabase
      .from("group_memberships")
      .select("group_id")
      .eq("course_id", courseId)
      .eq("user_id", targetUserId)
      .eq("group_id", targetGroupId)
      .maybeSingle();

    if (!targetMembership) {
      throw new Error("Target student is not in that course group.");
    }
  }

  const duplicateCheck = await supabase
    .from("group_requests")
    .select("id")
    .eq("course_id", courseId)
    .eq("requester_user_id", user.id)
    .eq("target_user_id", targetUserId)
    .eq("request_type", requestType)
    .eq("status", "pending")
    .maybeSingle();

  if (!duplicateCheck.error && duplicateCheck.data) {
    return;
  }

  const { error: insertError } = await supabase.from("group_requests").insert({
    course_id: courseId,
    requester_user_id: user.id,
    target_user_id: targetUserId,
    target_group_id: requestType === "join_group" ? targetGroupId : null,
    request_type: requestType,
    status: "pending",
  });

  if (insertError) {
    throw insertError;
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/course/${courseId}`);
}
