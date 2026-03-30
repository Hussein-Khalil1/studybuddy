"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type EndSessionPayload = {
  courseId: number;
  workMinutes: number;
  breakMinutes: number;
  startedAt: string;
  endedAt: string;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
};

function isPositiveInt(value: number) {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

function isNonNegativeInt(value: number) {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export async function endStudySessionAction(payload: EndSessionPayload) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const {
    courseId,
    workMinutes,
    breakMinutes,
    startedAt,
    endedAt,
    totalWorkMinutes,
    totalBreakMinutes,
  } = payload;

  if (!Number.isFinite(courseId)) {
    throw new Error("Invalid course.");
  }
  if (!isPositiveInt(workMinutes) || !isPositiveInt(breakMinutes)) {
    throw new Error("Invalid timer settings.");
  }
  if (!isNonNegativeInt(totalWorkMinutes) || !isNonNegativeInt(totalBreakMinutes)) {
    throw new Error("Invalid session totals.");
  }
  if (!startedAt || !endedAt) {
    throw new Error("Missing session timestamps.");
  }

  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("course_id")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .maybeSingle<{ course_id: number }>();

  if (!enrollment) {
    throw new Error("You are not enrolled in this course.");
  }

  const points = totalWorkMinutes;

  const { data: sessionRow, error: insertError } = await supabase
    .from("study_sessions")
    .insert({
      user_id: user.id,
      course_id: courseId,
      work_minutes: workMinutes,
      break_minutes: breakMinutes,
      total_work_minutes: totalWorkMinutes,
      total_break_minutes: totalBreakMinutes,
      points_awarded: points,
      started_at: startedAt,
      ended_at: endedAt,
    })
    .select("id")
    .maybeSingle<{ id: number }>();

  if (insertError) {
    throw insertError;
  }

  if (points > 0) {
    if (sessionRow?.id) {
      await supabase.from("point_events").upsert(
        {
          user_id: user.id,
          course_id: courseId,
          source: "study",
          points,
          ref_id: `study_session:${sessionRow.id}`,
        },
        { onConflict: "user_id,ref_id" }
      );
    }

    const { error: awardError } = await supabase.rpc("award_course_points", {
      p_user_id: user.id,
      p_course_id: courseId,
      p_points: points,
    });

    if (awardError) {
      throw awardError;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/rewards");

  return { points };
}
