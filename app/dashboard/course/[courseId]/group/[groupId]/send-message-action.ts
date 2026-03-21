"use server";

import { createClient } from "@/lib/supabase/server";

type SendMessageResult = { ok: boolean; error?: string };

export async function sendMessageAction(input: {
  groupId: number;
  content: string;
}): Promise<SendMessageResult> {
  const { groupId, content } = input;
  const trimmed = content.trim();

  if (!trimmed || trimmed.length > 2000) {
    return { ok: false, error: "Message must be 1–2000 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: membership } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { ok: false, error: "You are not a member of this group." };
  }

  const { error } = await supabase.from("group_messages").insert({
    group_id: groupId,
    user_id: user.id,
    content: trimmed,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
