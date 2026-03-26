"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher/client";
import {
  acceptCollabInviteAction,
  advanceCollabPhaseAction,
  createCollaborativeSessionAction,
  endCollaborativeSessionAction,
  inviteCollaborativeSessionAction,
  joinCollaborativeSessionAction,
  leaveCollaborativeSessionAction,
  pauseCollabTimerAction,
  startCollabTimerAction,
} from "@/app/actions/collab-session-actions";

type Member = {
  id: string;
  username: string;
};

type ActiveSession = {
  id: number;
  group_id: number;
  course_id: number;
  host_user_id: string;
  work_minutes: number;
  break_minutes: number;
  current_phase: "work" | "break";
  phase_started_at: string | null;
  phase_duration_sec: number | null;
  paused_remaining_sec: number | null;
  is_running: boolean;
  active_count: number;
  started_at: string | null;
};

type Participant = {
  user_id: string;
  is_active: boolean;
  total_eligible_seconds: number;
  points_awarded: number;
};

type PendingInvite = {
  id: number;
  session_id: number;
};

type SessionLog = {
  id: number;
  host_user_id: string;
  started_at: string | null;
  ended_at: string | null;
  work_minutes: number;
  break_minutes: number;
};

type Props = {
  groupId: number;
  courseId: number;
  currentUserId: string;
  members: Member[];
  activeSession: ActiveSession | null;
  participants: Participant[];
  pendingInvite: PendingInvite | null;
  sessionLogs: SessionLog[];
};

type TimerState = {
  isRunning: boolean;
  currentPhase: "work" | "break";
  phaseStartedAt: string | null;
  phaseDurationSec: number | null;
  pausedRemainingSec: number | null;
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

export default function CollaborativeSessionPanel({
  groupId,
  courseId,
  currentUserId,
  members,
  activeSession,
  participants,
  pendingInvite,
  sessionLogs,
}: Props) {
  const router = useRouter();
  const [workMinutes, setWorkMinutes] = useState(activeSession?.work_minutes ?? 25);
  const [breakMinutes, setBreakMinutes] = useState(activeSession?.break_minutes ?? 5);
  const [selectedInvites, setSelectedInvites] = useState<string[]>([]);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [timerState, setTimerState] = useState<TimerState>(() => ({
    isRunning: activeSession?.is_running ?? false,
    currentPhase: activeSession?.current_phase ?? "work",
    phaseStartedAt: activeSession?.phase_started_at ?? null,
    phaseDurationSec: activeSession?.phase_duration_sec ?? null,
    pausedRemainingSec: activeSession?.paused_remaining_sec ?? null,
  }));
  const [remainingSec, setRemainingSec] = useState(() => {
    if (activeSession?.is_running && activeSession.phase_started_at && activeSession.phase_duration_sec) {
      const elapsed = Math.floor((Date.now() - new Date(activeSession.phase_started_at).getTime()) / 1000);
      return Math.max(0, activeSession.phase_duration_sec - elapsed);
    }
    return activeSession?.paused_remaining_sec ?? activeSession?.phase_duration_sec ?? workMinutes * 60;
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const advancingRef = useRef(false);

  const isHost = activeSession?.host_user_id === currentUserId;
  const myParticipant = participants.find((p) => p.user_id === currentUserId);
  const activeCount = activeSession?.active_count ?? 0;

  useEffect(() => {
    setTimerState({
      isRunning: activeSession?.is_running ?? false,
      currentPhase: activeSession?.current_phase ?? "work",
      phaseStartedAt: activeSession?.phase_started_at ?? null,
      phaseDurationSec: activeSession?.phase_duration_sec ?? null,
      pausedRemainingSec: activeSession?.paused_remaining_sec ?? null,
    });
  }, [activeSession?.is_running, activeSession?.current_phase, activeSession?.phase_started_at, activeSession?.phase_duration_sec, activeSession?.paused_remaining_sec]);

  useEffect(() => {
    if (!timerState.isRunning) {
      setRemainingSec(timerState.pausedRemainingSec ?? timerState.phaseDurationSec ?? workMinutes * 60);
      return;
    }

    const interval = window.setInterval(() => {
      if (!timerState.phaseStartedAt || !timerState.phaseDurationSec) return;
      const elapsed = Math.floor((Date.now() - new Date(timerState.phaseStartedAt).getTime()) / 1000);
      const remaining = Math.max(0, timerState.phaseDurationSec - elapsed);
      setRemainingSec(remaining);

      if (remaining === 0 && isHost && !advancingRef.current) {
        advancingRef.current = true;
        playAlert();
        startTransition(async () => {
          await advanceCollabPhaseAction({ sessionId: activeSession!.id });
          advancingRef.current = false;
        });
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timerState, workMinutes, isHost, activeSession, startTransition]);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `group-${groupId}`;
    const channel = pusher.subscribe(channelName);

    const onEvent = (payload: {
      type: string;
      groupId: number;
      sessionId?: number;
      targetUserIds?: string[];
      isRunning?: boolean;
      currentPhase?: "work" | "break";
      phaseStartedAt?: string | null;
      phaseDurationSec?: number | null;
      pausedRemainingSec?: number | null;
    }) => {
      if (!payload || payload.groupId !== groupId) return;

      if (payload.type === "collab.timer_state" && payload.sessionId === activeSession?.id) {
        setTimerState({
          isRunning: payload.isRunning ?? false,
          currentPhase: payload.currentPhase ?? "work",
          phaseStartedAt: payload.phaseStartedAt ?? null,
          phaseDurationSec: payload.phaseDurationSec ?? null,
          pausedRemainingSec: payload.pausedRemainingSec ?? null,
        });
        return;
      }

      if (payload.type === "collab.invite" && payload.targetUserIds?.includes(currentUserId)) {
        setToast("You have a new collaborative session invite.");
      }

      router.refresh();
    };

    channel.bind("collab-session-updated", onEvent);

    return () => {
      channel.unbind("collab-session-updated", onEvent);
      pusher.unsubscribe(channelName);
    };
  }, [groupId, router, activeSession?.id, currentUserId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function playAlert() {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 780;
      gain.gain.value = 0.12;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // ignore audio errors
    }
  }

  const inviteChoices = useMemo(
    () => members.filter((m) => m.id !== currentUserId),
    [members, currentUserId]
  );

  function toggleInvite(id: string) {
    setSelectedInvites((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  function handleCreateSession() {
    startTransition(async () => {
      await createCollaborativeSessionAction({
        groupId,
        courseId,
        workMinutes,
        breakMinutes,
      });
      setInviteNotice(null);
      setSelectedInvites([]);
      router.refresh();
    });
  }

  function handleInvite() {
    if (!activeSession) return;
    startTransition(async () => {
      const result = await inviteCollaborativeSessionAction({
        sessionId: activeSession.id,
        groupId,
        courseId,
        targetUserIds: selectedInvites,
      });
      setInviteNotice(`Invited ${result.invited} member${result.invited === 1 ? "" : "s"}.`);
      setSelectedInvites([]);
    });
  }

  function handleJoin() {
    if (!activeSession) return;
    startTransition(async () => {
      await joinCollaborativeSessionAction({ sessionId: activeSession.id });
      router.refresh();
    });
  }

  function handleLeave() {
    if (!activeSession) return;
    startTransition(async () => {
      await leaveCollaborativeSessionAction({ sessionId: activeSession.id });
      router.refresh();
    });
  }

  function handleAcceptInvite() {
    if (!pendingInvite) return;
    startTransition(async () => {
      await acceptCollabInviteAction({ inviteId: pendingInvite.id });
      router.refresh();
    });
  }

  function handleStartTimer() {
    if (!activeSession) return;
    startTransition(async () => {
      await startCollabTimerAction({ sessionId: activeSession.id });
    });
  }

  function handlePauseTimer() {
    if (!activeSession) return;
    startTransition(async () => {
      await pauseCollabTimerAction({ sessionId: activeSession.id });
    });
  }

  function handleEndSession() {
    if (!activeSession) return;
    startTransition(async () => {
      await endCollaborativeSessionAction({ sessionId: activeSession.id });
      router.refresh();
    });
  }

  const phaseLabel = timerState.currentPhase === "work" ? "Work Interval" : "Break Interval";
  const progressPct = timerState.phaseDurationSec
    ? ((timerState.phaseDurationSec - remainingSec) / timerState.phaseDurationSec) * 100
    : 0;

  return (
    <section className="px-4 py-4 bg-white border-b border-[rgba(0,0,0,0.07)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[rgba(42,32,40,0.45)]">
            Collaborative Session
          </p>
          <h2 className="text-lg font-semibold text-[#2a2028]">Shared Pomodoro Timer</h2>
          <p className="text-xs text-[rgba(42,32,40,0.45)] mt-1">
            Timer only counts while 2+ members are active.
          </p>
        </div>
        {toast && (
          <div className="text-xs bg-[#f8f6f4] border border-[rgba(0,0,0,0.05)] rounded-lg px-3 py-2">
            {toast}
          </div>
        )}
      </div>

      {!activeSession && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[rgba(42,32,40,0.6)] mb-1">
                  Work (min)
                </label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={workMinutes}
                  onChange={(e) => setWorkMinutes(clampInt(parseInt(e.target.value, 10), 1, 180))}
                  className="w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.1)] text-sm text-[#2a2028] bg-[#f8f6f4] focus:outline-none focus:border-[#c2708a] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[rgba(42,32,40,0.6)] mb-1">
                  Break (min)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(clampInt(parseInt(e.target.value, 10), 1, 60))}
                  className="w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.1)] text-sm text-[#2a2028] bg-[#f8f6f4] focus:outline-none focus:border-[#c2708a] transition-colors"
                />
              </div>
            </div>
            <button
              onClick={handleCreateSession}
              disabled={isPending}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-60"
            >
              {isPending ? "Starting..." : "Start Collaborative Session"}
            </button>
          </div>
          <div className="bg-[#f8f6f4] rounded-2xl p-4 border border-[rgba(0,0,0,0.05)]">
            <p className="text-xs text-[rgba(42,32,40,0.55)] mb-2">
              Invite your group after you start a session.
            </p>
            <p className="text-xs text-[rgba(42,32,40,0.4)]">
              Members can join with one click and points will be calculated per participant.
            </p>
          </div>
        </div>
      )}

      {activeSession && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            {pendingInvite && (
              <div className="rounded-xl border border-[rgba(194,112,138,0.35)] bg-[rgba(194,112,138,0.07)] px-4 py-3">
                <p className="text-sm font-semibold text-[#2a2028]">
                  You have a session invite
                </p>
                <p className="text-xs text-[rgba(42,32,40,0.45)] mt-0.5">
                  Join now to sync with your group.
                </p>
                <button
                  onClick={handleAcceptInvite}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-xs font-semibold hover:opacity-90 transition"
                >
                  Join session
                </button>
              </div>
            )}

            <div className="bg-[#f8f6f4] rounded-2xl p-4 border border-[rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[rgba(42,32,40,0.45)]">
                  {phaseLabel}
                </span>
                <span className="text-xs text-[rgba(42,32,40,0.45)]">
                  {timerState.isRunning ? "Running" : "Paused"}
                </span>
              </div>
              <div className="text-3xl font-bold text-[#2a2028] tabular-nums mb-2">
                {formatTime(remainingSec)}
              </div>
              <div className="h-2 bg-white/70 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-[rgba(42,32,40,0.55)]">
                <span>Active members: {activeCount}</span>
                <span>{activeSession.work_minutes}/{activeSession.break_minutes} min cycles</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {!myParticipant?.is_active && (
                <button
                  onClick={handleJoin}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.12)] text-sm font-medium text-[#2a2028] hover:bg-[#f8f6f4] transition-all disabled:opacity-60"
                >
                  Join Session
                </button>
              )}
              {myParticipant?.is_active && (
                <button
                  onClick={handleLeave}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.12)] text-sm font-medium text-[#2a2028] hover:bg-[#f8f6f4] transition-all disabled:opacity-60"
                >
                  Leave Session
                </button>
              )}

              {isHost && (
                <>
                  {!timerState.isRunning && (
                    <button
                      onClick={handleStartTimer}
                      disabled={isPending || activeCount < 2}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-60"
                    >
                      {timerState.pausedRemainingSec ? "Resume Timer" : "Start Timer"}
                    </button>
                  )}
                  {timerState.isRunning && (
                    <button
                      onClick={handlePauseTimer}
                      disabled={isPending}
                      className="px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.12)] text-sm font-medium text-[#2a2028] hover:bg-[#f8f6f4] transition-all disabled:opacity-60"
                    >
                      Pause Timer
                    </button>
                  )}
                  <button
                    onClick={handleEndSession}
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.12)] text-sm font-medium text-[#2a2028] hover:bg-[#f8f6f4] transition-all disabled:opacity-60"
                  >
                    End Session
                  </button>
                </>
              )}
            </div>

            {activeCount < 2 && (
              <p className="text-xs text-rose-500">
                At least two members must be active for the timer to run.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-4">
              <p className="text-sm font-semibold text-[#2a2028] mb-3">Participants</p>
              <div className="space-y-2">
                {participants.map((p) => {
                  const member = members.find((m) => m.id === p.user_id);
                  const name = member?.username ?? "Student";
                  const minutes = Math.round(p.total_eligible_seconds / 60);
                  return (
                    <div
                      key={p.user_id}
                      className="flex items-center justify-between text-xs text-[rgba(42,32,40,0.6)]"
                    >
                      <span className={`font-semibold ${p.is_active ? "text-[#2a2028]" : "text-[rgba(42,32,40,0.45)]"}`}>
                        {name} {p.is_active && "(active)"}
                      </span>
                      <span>{minutes} min</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {isHost && (
              <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-4">
                <p className="text-sm font-semibold text-[#2a2028] mb-3">Invite Members</p>
                <div className="space-y-2">
                  {inviteChoices.map((member) => (
                    <label key={member.id} className="flex items-center gap-2 text-xs text-[rgba(42,32,40,0.6)]">
                      <input
                        type="checkbox"
                        checked={selectedInvites.includes(member.id)}
                        onChange={() => toggleInvite(member.id)}
                        className="accent-[#c2708a]"
                      />
                      {member.username}
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleInvite}
                  disabled={selectedInvites.length === 0 || isPending}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-60"
                >
                  Send Invites
                </button>
                {inviteNotice && (
                  <p className="mt-2 text-[10px] text-[rgba(42,32,40,0.45)]">{inviteNotice}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <p className="text-sm font-semibold text-[#2a2028] mb-2">Session Logs</p>
        {sessionLogs.length === 0 ? (
          <p className="text-xs text-[rgba(42,32,40,0.4)]">No collaborative sessions yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {sessionLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-[rgba(0,0,0,0.06)] px-3 py-2 text-xs text-[rgba(42,32,40,0.6)]"
              >
                <p className="font-semibold text-[#2a2028]">
                  {log.work_minutes}/{log.break_minutes} min cycle
                </p>
                <p>
                  {log.started_at
                    ? new Date(log.started_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Unknown date"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
