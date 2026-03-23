"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractTextFromPDF, extractEvents } from "@/lib/syllabus-parser";

type UploadResult = {
  ok: boolean;
  error?: string;
  eventsExtracted?: number;
  fileName?: string;
};

export async function uploadSyllabusAction(formData: FormData): Promise<UploadResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const file    = formData.get("file") as File | null;
  const groupId = Number(formData.get("groupId"));
  const courseId = Number(formData.get("courseId"));

  if (!file)                           return { ok: false, error: "No file selected." };
  if (file.type !== "application/pdf") return { ok: false, error: "Only PDF files are allowed." };
  if (file.size > 20 * 1024 * 1024)   return { ok: false, error: "File must be under 20 MB." };

  // Verify membership
  const { data: membership } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "Not a member of this group." };

  // Remove old file from storage if it exists
  const { data: existing } = await supabase
    .from("syllabi")
    .select("file_path")
    .eq("group_id", groupId)
    .maybeSingle();
  if (existing?.file_path) {
    await supabase.storage.from("syllabi").remove([existing.file_path]);
    // Remove previously auto-extracted assignments so they don't duplicate
    await supabase
      .from("assignments")
      .delete()
      .eq("group_id", groupId)
      .eq("source", "auto");
  }

  // Upload to Supabase Storage
  const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath  = `${groupId}/${Date.now()}_${safeName}`;
  const arrayBuf  = await file.arrayBuffer();
  const buffer    = Buffer.from(arrayBuf);

  const { error: uploadErr } = await supabase.storage
    .from("syllabi")
    .upload(filePath, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  // Upsert metadata
  const { data: syllabus, error: dbErr } = await supabase
    .from("syllabi")
    .upsert(
      { group_id: groupId, course_id: courseId, uploaded_by: user.id,
        file_path: filePath, file_name: file.name, parsed_at: null, events_extracted: 0 },
      { onConflict: "group_id" }
    )
    .select("id")
    .single();
  if (dbErr) return { ok: false, error: dbErr.message };

  // Parse PDF and extract events
  let eventsExtracted = 0;
  try {
    const text   = await extractTextFromPDF(buffer);
    const events = extractEvents(text);

    if (events.length > 0) {
      const rows = events.map(e => ({
        group_id:   groupId,
        course_id:  courseId,
        created_by: user.id,
        title:      e.title.substring(0, 195),
        due_date:   e.dueDate,
        prep_date:  e.prepDate,
        event_type: e.eventType,
        source:     "auto",
        is_flagged: e.isFlagged,
      }));

      const { data: inserted } = await supabase
        .from("assignments")
        .insert(rows)
        .select("id");
      eventsExtracted = inserted?.length ?? 0;
    }
  } catch {
    // Parsing is best-effort — upload still succeeds
  }

  // Update parsed metadata
  await supabase
    .from("syllabi")
    .update({ parsed_at: new Date().toISOString(), events_extracted: eventsExtracted })
    .eq("id", syllabus.id);

  revalidatePath(`/dashboard/course/${courseId}/group/${groupId}`);
  revalidatePath("/dashboard/calendar");

  return { ok: true, eventsExtracted, fileName: file.name };
}

export async function getSyllabusDownloadUrl(groupId: number): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: syllabus } = await supabase
    .from("syllabi")
    .select("file_path")
    .eq("group_id", groupId)
    .maybeSingle();
  if (!syllabus) return null;

  const { data } = await supabase.storage
    .from("syllabi")
    .createSignedUrl(syllabus.file_path, 3600);
  return data?.signedUrl ?? null;
}
