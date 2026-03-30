"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { triggerGroupEvent } from "@/lib/pusher/server";

type CreateSessionPayload = {
  groupId: number;
  courseId: number;
  workMinutes: number;
  breakMinutes: number;
};

type InvitePayload = {
  sessionId: number;
  groupId: number;
  courseId: number;
  targetUserIds: string[];
};

type JoinPayload = {
  sessionId: number;
};

type AcceptInvitePayload = {
  inviteId: number;
};

type DeclineInvitePayload = {
  inviteId: number;
};

type TimerPayload = {
  sessionId: number;
};

type CollabSessionRow = {
  id: number;
  group_id: number;
  course_id: number;
  host_user_id: string;
  work_minutes: number;
  break_minutes: number;
  status: "active" | "ended";
  current_phase: "work" | "break";
  phase_started_at: string | null;
  phase_duration_sec: number | null;
  paused_remaining_sec: number | null;
  is_running: boolean;
  active_count: number;
  eligible_started_at: string | null;
  started_at: string | null;
};

type ParticipantRow = {
  session_id: number;
  user_id: string;
  is_active: boolean;
  last_joined_at: string | null;
  last_left_at: string | null;
  last_eligible_at: string | null;
  total_active_seconds: number;
  total_eligible_seconds: number;
  points_awarded: number;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function assertPositiveInt(value: number, label: string) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label}.`);
  }
}

function secondsBetween(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.round((end - start) / 1000));
}

async function getSession(supabase: SupabaseServerClient, sessionId: number) {
  const { data } = await supabase
    .from("collab_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle<CollabSessionRow>();
  if (!data) throw new Error("Session not found.");
  return data;
}

async function setEligibilityStartForActiveParticipants(
  supabase: SupabaseServerClient,
  sessionId: number,
  nowIso: string
) {
  const { data: activeParticipants } = await supabase
    .from("collab_session_participants")
    .select("user_id, last_eligible_at")
    .eq("session_id", sessionId)
    .eq("is_active", true)
    .returns<Pick<ParticipantRow, "user_id" | "last_eligible_at">[]>();

  for (const participant of activeParticipants ?? []) {
    if (participant.last_eligible_at) continue;
    await supabase
      .from("collab_session_participants")
      .update({ last_eligible_at: nowIso })
      .eq("session_id", sessionId)
      .eq("user_id", participant.user_id);
  }
}

async function closeEligibilityForActiveParticipants(
  supabase: SupabaseServerClient,
  sessionId: number,
  nowIso: string
) {
  const { data: activeParticipants } = await supabase
    .from("collab_session_participants")
    .select("user_id, last_eligible_at, total_eligible_seconds")
    .eq("session_id", sessionId)
    .eq("is_active", true)
    .returns<Pick<ParticipantRow, "user_id" | "last_eligible_at" | "total_eligible_seconds">[]>();

  for (const participant of activeParticipants ?? []) {
    if (!participant.last_eligible_at) continue;
    const delta = secondsBetween(participant.last_eligible_at, nowIso);
    await supabase
      .from("collab_session_participants")
      .update({
        last_eligible_at: null,
        total_eligible_seconds: participant.total_eligible_seconds + delta,
      })
      .eq("session_id", sessionId)
      .eq("user_id", participant.user_id);
  }
}

async function joinSession(
  supabase: SupabaseServerClient,
  sessionId: number,
  userId: string
) {
  const session = await getSession(supabase, sessionId);
  if (session.status !== "active") {
    throw new Error("Session is no longer active.");
  }

  const { data: membership } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("group_id", session.group_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) {
    throw new Error("You are not a member of this group.");
  }

  const nowIso = new Date().toISOString();
  const { data: participant } = await supabase
    .from("collab_session_participants")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle<ParticipantRow>();

  if (participant?.is_active) {
    return session;
  }

  if (!participant) {
    const { error: insertError } = await supabase
      .from("collab_session_participants")
      .insert({
        session_id: sessionId,
        user_id: userId,
        is_active: true,
        last_joined_at: nowIso,
      });
    if (insertError) throw insertError;
  } else {
    const { error: updateError } = await supabase
      .from("collab_session_participants")
      .update({ is_active: true, last_joined_at: nowIso, last_left_at: null })
      .eq("session_id", sessionId)
      .eq("user_id", userId);
    if (updateError) throw updateError;
  }

  const newActiveCount = session.active_count + 1;
  const { error: sessionUpdateError } = await supabase
    .from("collab_sessions")
    .update({
      active_count: newActiveCount,
      eligible_started_at: newActiveCount >= 2 ? session.eligible_started_at ?? nowIso : null,
    })
    .eq("id", sessionId);
  if (sessionUpdateError) throw sessionUpdateError;

  if (newActiveCount >= 2) {
    if (!session.eligible_started_at) {
      await setEligibilityStartForActiveParticipants(supabase, sessionId, nowIso);
    } else {
      await supabase
        .from("collab_session_participants")
        .update({ last_eligible_at: nowIso })
        .eq("session_id", sessionId)
        .eq("user_id", userId);
    }
  }

  return { ...session, active_count: newActiveCount, eligible_started_at: newActiveCount >= 2 ? (session.eligible_started_at ?? nowIso) : null };
}

async function leaveSession(
  supabase: SupabaseServerClient,
  sessionId: number,
  userId: string
) {
  const session = await getSession(supabase, sessionId);
  const { data: participant } = await supabase
    .from("collab_session_participants")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle<ParticipantRow>();

  if (!participant || !participant.is_active) {
    return session;
  }

  const nowIso = new Date().toISOString();
  const activeDelta = participant.last_joined_at
    ? secondsBetween(participant.last_joined_at, nowIso)
    : 0;
  const eligibleDelta = participant.last_eligible_at
    ? secondsBetween(participant.last_eligible_at, nowIso)
    : 0;

  const { error: participantUpdateError } = await supabase
    .from("collab_session_participants")
    .update({
      is_active: false,
      last_joined_at: null,
      last_left_at: nowIso,
      last_eligible_at: null,
      total_active_seconds: participant.total_active_seconds + activeDelta,
      total_eligible_seconds: participant.total_eligible_seconds + eligibleDelta,
    })
    .eq("session_id", sessionId)
    .eq("user_id", userId);
  if (participantUpdateError) throw participantUpdateError;

  const newActiveCount = Math.max(0, session.active_count - 1);
  const shouldEndEligibility = newActiveCount < 2 && session.eligible_started_at;

  if (shouldEndEligibility) {
    await closeEligibilityForActiveParticipants(supabase, sessionId, nowIso);
  }

  let pausedRemainingSec = session.paused_remaining_sec;
  let isRunning = session.is_running;
  let phaseStartedAt = session.phase_started_at;
  let phaseDurationSec = session.phase_duration_sec;

  if (session.is_running && newActiveCount < 2 && session.phase_started_at && session.phase_duration_sec) {
    const elapsed = secondsBetween(session.phase_started_at, nowIso);
    pausedRemainingSec = Math.max(0, session.phase_duration_sec - elapsed);
    isRunning = false;
    phaseStartedAt = null;
    phaseDurationSec = null;
  }

  const { error: sessionUpdateError } = await supabase
    .from("collab_sessions")
    .update({
      active_count: newActiveCount,
      eligible_started_at: shouldEndEligibility ? null : session.eligible_started_at,
      is_running: isRunning,
      paused_remaining_sec: pausedRemainingSec,
      phase_started_at: phaseStartedAt,
      phase_duration_sec: phaseDurationSec,
    })
    .eq("id", sessionId);
  if (sessionUpdateError) throw sessionUpdateError;

  return {
    ...session,
    active_count: newActiveCount,
    eligible_started_at: shouldEndEligibility ? null : session.eligible_started_at,
    is_running: isRunning,
    paused_remaining_sec: pausedRemainingSec,
    phase_started_at: phaseStartedAt,
    phase_duration_sec: phaseDurationSec,
  };
}

export async function createCollaborativeSessionAction(payload: CreateSessionPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { groupId, courseId, workMinutes, breakMinutes } = payload;
  assertPositiveInt(groupId, "group");
  assertPositiveInt(courseId, "course");
  assertPositiveInt(workMinutes, "work minutes");
  assertPositiveInt(breakMinutes, "break minutes");

  const { data: membership } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) throw new Error("You are not a member of this group.");

  const { data: existing } = await supabase
    .from("collab_sessions")
    .select("id")
    .eq("group_id", groupId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) throw new Error("A collaborative session is already active.");

  const nowIso = new Date().toISOString();
  const { data: session, error } = await supabase
    .from("collab_sessions")
    .insert({
      group_id: groupId,
      course_id: courseId,
      host_user_id: user.id,
      work_minutes: workMinutes,
      break_minutes: breakMinutes,
      status: "active",
      active_count: 1,
      current_phase: "work",
    })
    .select("*")
    .maybeSingle<CollabSessionRow>();
  if (error) throw error;
  if (!session) throw new Error("Failed to create session.");

  const { error: participantError } = await supabase
    .from("collab_session_participants")
    .insert({
      session_id: session.id,
      user_id: user.id,
      is_active: true,
      last_joined_at: nowIso,
    });
  if (participantError) throw participantError;

  await triggerGroupEvent({
    type: "collab.session_created",
    groupId,
    sessionId: session.id,
  });

  revalidatePath(`/dashboard/course/${courseId}/group/${groupId}`);
  return { sessionId: session.id };
}

export async function inviteCollaborativeSessionAction(payload: InvitePayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { sessionId, groupId, courseId, targetUserIds } = payload;
  const session = await getSession(supabase, sessionId);
  if (session.host_user_id !== user.id) throw new Error("Only the host can invite.");

  const uniqueTargets = [...new Set(targetUserIds.filter((id) => id !== user.id))];
  if (uniqueTargets.length === 0) return { invited: 0 };

  const rows = uniqueTargets.map((target) => ({
    session_id: sessionId,
    group_id: groupId,
    course_id: courseId,
    inviter_user_id: user.id,
    target_user_id: target,
    status: "pending",
  }));

  const { error } = await supabase
    .from("collab_session_invites")
    .upsert(rows, { onConflict: "session_id,target_user_id" });
  if (error) throw error;

  await triggerGroupEvent({
    type: "collab.invite",
    groupId,
    sessionId,
    targetUserIds: uniqueTargets,
  });

  revalidatePath(`/dashboard/course/${courseId}/group/${groupId}`);
  return { invited: uniqueTargets.length };
}

export async function joinCollaborativeSessionAction(payload: JoinPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const session = await joinSession(supabase, payload.sessionId, user.id);

  await triggerGroupEvent({
    type: "collab.participants",
    groupId: session.group_id,
    sessionId: session.id,
    activeCount: session.active_count,
  });

  revalidatePath(`/dashboard/course/${session.course_id}/group/${session.group_id}`);
  return { ok: true };
}

export async function acceptCollabInviteAction(payload: AcceptInvitePayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: invite } = await supabase
    .from("collab_session_invites")
    .select("*")
    .eq("id", payload.inviteId)
    .eq("target_user_id", user.id)
    .maybeSingle<{
      id: number;
      session_id: number;
      group_id: number;
      course_id: number;
      status: string;
    }>();
  if (!invite) throw new Error("Invite not found.");

  if (invite.status !== "accepted") {
    const { error } = await supabase
      .from("collab_session_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);
    if (error) throw error;
  }

  const session = await joinSession(supabase, invite.session_id, user.id);

  await triggerGroupEvent({
    type: "collab.participants",
    groupId: session.group_id,
    sessionId: session.id,
    activeCount: session.active_count,
  });

  revalidatePath(`/dashboard/course/${invite.course_id}/group/${invite.group_id}`);
  revalidatePath("/dashboard/notifications");
  return { ok: true };
}

export async function declineCollabInviteAction(payload: DeclineInvitePayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: invite } = await supabase
    .from("collab_session_invites")
    .select("id, group_id, course_id, status")
    .eq("id", payload.inviteId)
    .eq("target_user_id", user.id)
    .maybeSingle();
  if (!invite) throw new Error("Invite not found.");

  if (invite.status !== "declined") {
    const { error } = await supabase
      .from("collab_session_invites")
      .update({ status: "declined" })
      .eq("id", invite.id);
    if (error) throw error;
  }

  revalidatePath(`/dashboard/notifications`);
  return { ok: true };
}

export async function leaveCollaborativeSessionAction(payload: JoinPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const session = await leaveSession(supabase, payload.sessionId, user.id);

  await triggerGroupEvent({
    type: "collab.participants",
    groupId: session.group_id,
    sessionId: session.id,
    activeCount: session.active_count,
  });

  if (!session.is_running && session.paused_remaining_sec !== null) {
    await triggerGroupEvent({
      type: "collab.timer_state",
      groupId: session.group_id,
      sessionId: session.id,
      isRunning: false,
      currentPhase: session.current_phase,
      phaseStartedAt: session.phase_started_at,
      phaseDurationSec: session.phase_duration_sec,
      pausedRemainingSec: session.paused_remaining_sec,
    });
  }

  revalidatePath(`/dashboard/course/${session.course_id}/group/${session.group_id}`);
  return { ok: true };
}

export async function startCollabTimerAction(payload: TimerPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const session = await getSession(supabase, payload.sessionId);
  if (session.host_user_id !== user.id) throw new Error("Only the host can start the timer.");
  if (session.active_count < 2) throw new Error("At least two members must be active.");

  const nowIso = new Date().toISOString();
  const phaseDuration = session.paused_remaining_sec ?? session.work_minutes * 60;

  const { error } = await supabase
    .from("collab_sessions")
    .update({
      is_running: true,
      started_at: session.started_at ?? nowIso,
      phase_started_at: nowIso,
      phase_duration_sec: phaseDuration,
      paused_remaining_sec: null,
      current_phase: session.paused_remaining_sec ? session.current_phase : "work",
    })
    .eq("id", session.id);
  if (error) throw error;

  await triggerGroupEvent({
    type: "collab.timer_state",
    groupId: session.group_id,
    sessionId: session.id,
    isRunning: true,
    currentPhase: session.paused_remaining_sec ? session.current_phase : "work",
    phaseStartedAt: nowIso,
    phaseDurationSec: phaseDuration,
    pausedRemainingSec: null,
  });

  revalidatePath(`/dashboard/course/${session.course_id}/group/${session.group_id}`);
  return { ok: true };
}

export async function pauseCollabTimerAction(payload: TimerPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const session = await getSession(supabase, payload.sessionId);
  if (session.host_user_id !== user.id) throw new Error("Only the host can pause the timer.");
  if (!session.is_running || !session.phase_started_at || !session.phase_duration_sec) return { ok: true };

  const nowIso = new Date().toISOString();
  const elapsed = secondsBetween(session.phase_started_at, nowIso);
  const remaining = Math.max(0, session.phase_duration_sec - elapsed);

  const { error } = await supabase
    .from("collab_sessions")
    .update({
      is_running: false,
      paused_remaining_sec: remaining,
      phase_started_at: null,
      phase_duration_sec: null,
    })
    .eq("id", session.id);
  if (error) throw error;

  await triggerGroupEvent({
    type: "collab.timer_state",
    groupId: session.group_id,
    sessionId: session.id,
    isRunning: false,
    currentPhase: session.current_phase,
    phaseStartedAt: null,
    phaseDurationSec: null,
    pausedRemainingSec: remaining,
  });

  revalidatePath(`/dashboard/course/${session.course_id}/group/${session.group_id}`);
  return { ok: true };
}

export async function advanceCollabPhaseAction(payload: TimerPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const session = await getSession(supabase, payload.sessionId);
  if (session.host_user_id !== user.id) throw new Error("Only the host can advance the timer.");
  if (!session.is_running) return { ok: true };

  const nowIso = new Date().toISOString();
  const nextPhase = session.current_phase === "work" ? "break" : "work";
  const nextDuration = (nextPhase === "work" ? session.work_minutes : session.break_minutes) * 60;

  const { error } = await supabase
    .from("collab_sessions")
    .update({
      current_phase: nextPhase,
      phase_started_at: nowIso,
      phase_duration_sec: nextDuration,
      paused_remaining_sec: null,
      is_running: true,
    })
    .eq("id", session.id);
  if (error) throw error;

  await triggerGroupEvent({
    type: "collab.timer_state",
    groupId: session.group_id,
    sessionId: session.id,
    isRunning: true,
    currentPhase: nextPhase,
    phaseStartedAt: nowIso,
    phaseDurationSec: nextDuration,
    pausedRemainingSec: null,
  });

  revalidatePath(`/dashboard/course/${session.course_id}/group/${session.group_id}`);
  return { ok: true };
}

export async function endCollaborativeSessionAction(payload: TimerPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const session = await getSession(supabase, payload.sessionId);
  if (session.host_user_id !== user.id) throw new Error("Only the host can end the session.");

  const nowIso = new Date().toISOString();

  if (session.eligible_started_at) {
    await closeEligibilityForActiveParticipants(supabase, session.id, nowIso);
  }

  const { data: activeParticipants } = await supabase
    .from("collab_session_participants")
    .select("*")
    .eq("session_id", session.id)
    .eq("is_active", true)
    .returns<ParticipantRow[]>();

  for (const participant of activeParticipants ?? []) {
    const activeDelta = participant.last_joined_at
      ? secondsBetween(participant.last_joined_at, nowIso)
      : 0;
    await supabase
      .from("collab_session_participants")
      .update({
        is_active: false,
        last_joined_at: null,
        last_left_at: nowIso,
        last_eligible_at: null,
        total_active_seconds: participant.total_active_seconds + activeDelta,
      })
      .eq("session_id", session.id)
      .eq("user_id", participant.user_id);
  }

  const { data: allParticipants } = await supabase
    .from("collab_session_participants")
    .select("*")
    .eq("session_id", session.id)
    .returns<ParticipantRow[]>();

  for (const participant of allParticipants ?? []) {
    const points = Math.round(participant.total_eligible_seconds / 60);
    await supabase
      .from("collab_session_participants")
      .update({ points_awarded: points })
      .eq("session_id", session.id)
      .eq("user_id", participant.user_id);

    if (points > 0) {
      await supabase.from("point_events").upsert(
        {
          user_id: participant.user_id,
          course_id: session.course_id,
          source: "collab",
          points,
          ref_id: `collab_session:${session.id}:${participant.user_id}`,
        },
        { onConflict: "user_id,ref_id" }
      );

      await supabase.rpc("award_course_points", {
        p_user_id: participant.user_id,
        p_course_id: session.course_id,
        p_points: points,
      });
    }

    const { data: totals } = await supabase
      .from("collab_session_participants")
      .select("total_eligible_seconds, collab_sessions!inner(course_id)")
      .eq("user_id", participant.user_id)
      .eq("collab_sessions.course_id", session.course_id)
      .returns<{ total_eligible_seconds: number }[]>();

    const totalEligible = (totals ?? []).reduce((sum, row) => sum + row.total_eligible_seconds, 0);
    if (totalEligible >= 20 * 60 * 60) {
      const { data: existingMilestone } = await supabase
        .from("collab_session_milestones")
        .select("id")
        .eq("user_id", participant.user_id)
        .eq("course_id", session.course_id)
        .eq("milestone", "20_hours")
        .maybeSingle();

      if (!existingMilestone) {
        await supabase.from("collab_session_milestones").insert({
          user_id: participant.user_id,
          course_id: session.course_id,
          milestone: "20_hours",
        });

        await supabase.from("point_events").upsert(
          {
            user_id: participant.user_id,
            course_id: session.course_id,
            source: "milestone",
            points: 100,
            ref_id: `collab_20h:${session.course_id}`,
          },
          { onConflict: "user_id,ref_id" }
        );

        await supabase.rpc("award_course_points", {
          p_user_id: participant.user_id,
          p_course_id: session.course_id,
          p_points: 100,
        });
      }
    }
  }

  const { error } = await supabase
    .from("collab_sessions")
    .update({
      status: "ended",
      ended_at: nowIso,
      is_running: false,
      paused_remaining_sec: null,
      active_count: 0,
      phase_started_at: null,
      phase_duration_sec: null,
      eligible_started_at: null,
    })
    .eq("id", session.id);
  if (error) throw error;

  await triggerGroupEvent({
    type: "collab.session_ended",
    groupId: session.group_id,
    sessionId: session.id,
  });

  revalidatePath(`/dashboard/course/${session.course_id}/group/${session.group_id}`);
  revalidatePath("/dashboard/rewards");
  revalidatePath("/dashboard/profile");
  return { ok: true };
}
