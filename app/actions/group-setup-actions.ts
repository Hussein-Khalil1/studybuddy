"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { triggerCourseEvent } from "@/lib/pusher/server";

type ActionResult = {
  ok: boolean;
  error?: string;
};

type InviteRequestRow = {
  id: number;
  course_id: number;
  requester_user_id: string;
  target_user_id: string;
  target_group_id: number;
  status: "pending" | "accepted" | "declined" | "cancelled";
};

function isPostgresUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function asMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: string }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

async function ensureEnrolled(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  courseId: number,
) {
  const { data } = await supabase
    .from("course_enrollments")
    .select("course_id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  return Boolean(data);
}

export async function sendGroupInviteAction(input: {
  courseId: number;
  targetUserId: string;
}): Promise<ActionResult> {
  try {
    if (!input.courseId || !input.targetUserId) {
      return { ok: false, error: "Invalid invite payload." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "You must be signed in." };
    }

    if (user.id === input.targetUserId) {
      return { ok: false, error: "You cannot invite yourself." };
    }

    const [meEnrolled, targetEnrolled] = await Promise.all([
      ensureEnrolled(supabase, user.id, input.courseId),
      ensureEnrolled(supabase, input.targetUserId, input.courseId),
    ]);

    if (!meEnrolled || !targetEnrolled) {
      return { ok: false, error: "Both students must be enrolled in this course." };
    }

    const { data: targetMembership } = await supabase
      .from("group_memberships")
      .select("group_id")
      .eq("course_id", input.courseId)
      .eq("user_id", input.targetUserId)
      .maybeSingle();

    if (targetMembership) {
      return { ok: false, error: "This student is already in a group for this course." };
    }

    const { data: existingPending } = await supabase
      .from("group_requests")
      .select("id")
      .eq("course_id", input.courseId)
      .eq("requester_user_id", user.id)
      .eq("target_user_id", input.targetUserId)
      .eq("status", "pending")
      .maybeSingle();

    if (existingPending) {
      return { ok: true };
    }

    const { data: myMembership } = await supabase
      .from("group_memberships")
      .select("group_id")
      .eq("course_id", input.courseId)
      .eq("user_id", user.id)
      .maybeSingle();

    let groupId = myMembership?.group_id;

    if (!groupId) {
      const { data: createdGroup, error: groupError } = await supabase
        .from("study_groups")
        .insert({
          course_id: input.courseId,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (groupError || !createdGroup) {
        throw groupError ?? new Error("Unable to create your group.");
      }

      groupId = Number(createdGroup.id);

      const { error: joinError } = await supabase.from("group_memberships").insert({
        group_id: groupId,
        course_id: input.courseId,
        user_id: user.id,
      });

      if (joinError && !isPostgresUniqueViolation(joinError)) {
        throw joinError;
      }
    }

    const { count: currentMemberCount } = await supabase
      .from("group_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("course_id", input.courseId)
      .eq("group_id", groupId);

    if ((currentMemberCount ?? 0) >= 5) {
      return { ok: false, error: "Group is full (max 5 members)." };
    }

    const { data: insertedInvite, error: insertError } = await supabase
      .from("group_requests")
      .insert({
        course_id: input.courseId,
        requester_user_id: user.id,
        target_user_id: input.targetUserId,
        target_group_id: groupId,
        request_type: "join_group",
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      if (isPostgresUniqueViolation(insertError)) {
        return { ok: true };
      }

      throw insertError;
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/course/${input.courseId}`);
    revalidatePath("/group-setup");

    await triggerCourseEvent({
      type: "invite.sent",
      courseId: input.courseId,
      groupId,
      requestId: insertedInvite?.id,
      fromUserId: user.id,
      targetUserId: input.targetUserId,
      memberCount: currentMemberCount ?? 1,
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: asMessage(error) };
  }
}

export async function requestToJoinGroupAction(input: {
  courseId: number;
  targetUserId: string;
}): Promise<ActionResult> {
  try {
    if (!input.courseId || !input.targetUserId) {
      return { ok: false, error: "Invalid join request payload." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "You must be signed in." };
    }

    if (user.id === input.targetUserId) {
      return { ok: false, error: "You cannot request to join yourself." };
    }

    const [meEnrolled, targetEnrolled] = await Promise.all([
      ensureEnrolled(supabase, user.id, input.courseId),
      ensureEnrolled(supabase, input.targetUserId, input.courseId),
    ]);

    if (!meEnrolled || !targetEnrolled) {
      return { ok: false, error: "Both students must be enrolled in this course." };
    }

    const { data: myMembership } = await supabase
      .from("group_memberships")
      .select("group_id")
      .eq("course_id", input.courseId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (myMembership) {
      return { ok: false, error: "You are already in a group for this course." };
    }

    const { data: targetMembership } = await supabase
      .from("group_memberships")
      .select("group_id")
      .eq("course_id", input.courseId)
      .eq("user_id", input.targetUserId)
      .maybeSingle();

    if (!targetMembership?.group_id) {
      return { ok: false, error: "This classmate is not in a group yet." };
    }

    const { count: currentMemberCount } = await supabase
      .from("group_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("course_id", input.courseId)
      .eq("group_id", targetMembership.group_id);

    if ((currentMemberCount ?? 0) >= 5) {
      return { ok: false, error: "That group is full (max 5 members)." };
    }

    const { data: existingPending } = await supabase
      .from("group_requests")
      .select("id")
      .eq("course_id", input.courseId)
      .eq("requester_user_id", user.id)
      .eq("target_user_id", input.targetUserId)
      .eq("request_type", "join_group")
      .eq("status", "pending")
      .maybeSingle();

    if (existingPending) {
      return { ok: true };
    }

    const { data: insertedRequest, error: insertError } = await supabase
      .from("group_requests")
      .insert({
        course_id: input.courseId,
        requester_user_id: user.id,
        target_user_id: input.targetUserId,
        target_group_id: targetMembership.group_id,
        request_type: "join_group",
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      if (isPostgresUniqueViolation(insertError)) {
        return { ok: true };
      }

      throw insertError;
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/course/${input.courseId}`);
    revalidatePath("/group-setup");

    await triggerCourseEvent({
      type: "invite.sent",
      courseId: input.courseId,
      groupId: targetMembership.group_id,
      requestId: insertedRequest?.id,
      fromUserId: user.id,
      targetUserId: input.targetUserId,
      memberCount: currentMemberCount ?? 0,
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: asMessage(error) };
  }
}

export async function respondToGroupInviteAction(input: {
  courseId: number;
  requestId: number;
  decision: "accept" | "decline";
}): Promise<ActionResult> {
  try {
    if (!input.courseId || !input.requestId || !input.decision) {
      return { ok: false, error: "Invalid invite response payload." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "You must be signed in." };
    }

    const { data: requestRow } = await supabase
      .from("group_requests")
      .select("id, course_id, requester_user_id, target_user_id, target_group_id, status")
      .eq("id", input.requestId)
      .eq("course_id", input.courseId)
      .maybeSingle<InviteRequestRow>();

    if (!requestRow || requestRow.target_user_id !== user.id) {
      return { ok: false, error: "Invite not found." };
    }

    if (requestRow.status !== "pending") {
      return { ok: false, error: "This invite has already been handled." };
    }

    if (input.decision === "decline") {
      const { error: declineError } = await supabase
        .from("group_requests")
        .update({ status: "declined", updated_at: new Date().toISOString() })
        .eq("id", requestRow.id)
        .eq("status", "pending");

      if (declineError) {
        throw declineError;
      }

      revalidatePath("/dashboard");
      revalidatePath(`/dashboard/course/${input.courseId}`);
      revalidatePath("/group-setup");

      await triggerCourseEvent({
        type: "invite.declined",
        courseId: input.courseId,
        groupId: requestRow.target_group_id,
        requestId: requestRow.id,
        fromUserId: requestRow.requester_user_id,
        targetUserId: requestRow.target_user_id,
      });

      return { ok: true };
    }

    const enrolled = await ensureEnrolled(supabase, user.id, input.courseId);
    if (!enrolled) {
      return { ok: false, error: "You must be enrolled in this course to join a group." };
    }

    const { data: requesterMembership } = await supabase
      .from("group_memberships")
      .select("group_id")
      .eq("course_id", input.courseId)
      .eq("user_id", requestRow.requester_user_id)
      .eq("group_id", requestRow.target_group_id)
      .maybeSingle();

    if (!requesterMembership) {
      return { ok: false, error: "The group is no longer available." };
    }

    const { data: myMembership } = await supabase
      .from("group_memberships")
      .select("group_id")
      .eq("course_id", input.courseId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (myMembership) {
      return { ok: false, error: "You are already in a group for this course." };
    }

    const { count: currentMemberCount } = await supabase
      .from("group_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("course_id", input.courseId)
      .eq("group_id", requestRow.target_group_id);

    if ((currentMemberCount ?? 0) >= 5) {
      return { ok: false, error: "Group is full (max 5 members)." };
    }

    const { error: insertMembershipError } = await supabase
      .from("group_memberships")
      .insert({
        group_id: requestRow.target_group_id,
        course_id: input.courseId,
        user_id: user.id,
      });

    if (insertMembershipError) {
      if (isPostgresUniqueViolation(insertMembershipError)) {
        return { ok: false, error: "You are already in a group for this course." };
      }

      throw insertMembershipError;
    }

    const { error: acceptError } = await supabase
      .from("group_requests")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", requestRow.id)
      .eq("status", "pending");

    if (acceptError) {
      throw acceptError;
    }

    const updatedMemberCount = (currentMemberCount ?? 0) + 1;

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/course/${input.courseId}`);
    revalidatePath("/group-setup");

    await triggerCourseEvent({
      type: "invite.accepted",
      courseId: input.courseId,
      groupId: requestRow.target_group_id,
      requestId: requestRow.id,
      fromUserId: requestRow.requester_user_id,
      targetUserId: requestRow.target_user_id,
      memberCount: updatedMemberCount,
    });

    await triggerCourseEvent({
      type: "group.member_count_changed",
      courseId: input.courseId,
      groupId: requestRow.target_group_id,
      memberCount: updatedMemberCount,
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: asMessage(error) };
  }
}
