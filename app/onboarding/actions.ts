"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type OnboardingState = {
  error: string | null;
};

const MAX_COURSES = 5;

function parseCourseIds(values: FormDataEntryValue[]) {
  const parsed = values
    .map((value) => (typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN))
    .filter((id) => Number.isFinite(id) && id > 0);

  return Array.from(new Set(parsed));
}

export async function saveOnboardingCoursesAction(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const courseIds = parseCourseIds(formData.getAll("courseId"));

  if (courseIds.length === 0) {
    return { error: "Select at least one course to continue." };
  }

  if (courseIds.length > MAX_COURSES) {
    return { error: `You can select up to ${MAX_COURSES} courses.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "You must be signed in to continue." };
  }

  const { error: deleteError } = await supabase
    .from("course_enrollments")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    return { error: deleteError.message || "Unable to save your courses. Please try again." };
  }

  const { error: insertError } = await supabase
    .from("course_enrollments")
    .insert(courseIds.map((course_id) => ({ user_id: user.id, course_id })));

  if (insertError) {
    return { error: insertError.message || "Unable to save your courses. Please try again." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message || "Unable to complete onboarding. Please try again." };
  }

  redirect("/group-setup");
}
