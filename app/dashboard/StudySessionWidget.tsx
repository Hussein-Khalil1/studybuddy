"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { endStudySessionAction } from "@/app/actions/study-session-actions";

type CourseOption = {
  id: number;
  code: string;
  title: string;
};

type Props = {
  courses: CourseOption[];
};

type Phase = "work" | "break";

const DEFAULT_WORK_MIN = 25;
const DEFAULT_BREAK_MIN = 5;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

export default function StudySessionWidget({ courses }: Props) {
  const [courseId, setCourseId] = useState<string>(courses[0]?.id?.toString() ?? "");
  const [workMinutes, setWorkMinutes] = useState(DEFAULT_WORK_MIN);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MIN);
  const [phase, setPhase] = useState<Phase>("work");
  const [remainingSec, setRemainingSec] = useState(DEFAULT_WORK_MIN * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [totalWorkSec, setTotalWorkSec] = useState(0);
  const [totalBreakSec, setTotalBreakSec] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [lastSaved, setLastSaved] = useState<{
    minutes: number;
    points: number;
    courseLabel: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>(phase);
  const workMinRef = useRef(workMinutes);
  const breakMinRef = useRef(breakMinutes);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    workMinRef.current = workMinutes;
  }, [workMinutes]);

  useEffect(() => {
    breakMinRef.current = breakMinutes;
  }, [breakMinutes]);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      if (phaseRef.current === "work") {
        setTotalWorkSec((s) => s + 1);
      } else {
        setTotalBreakSec((s) => s + 1);
      }

      setRemainingSec((prev) => {
        if (prev <= 1) {
          playAlert();
          const next: Phase = phaseRef.current === "work" ? "break" : "work";
          phaseRef.current = next;
          setPhase(next);
          const nextTotal =
            (next === "work" ? workMinRef.current : breakMinRef.current) * 60;
          return nextTotal;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning && !isPaused) {
      setPhase("work");
      setRemainingSec(workMinutes * 60);
      setTotalWorkSec(0);
      setTotalBreakSec(0);
      setStartedAt(null);
    }
  }, [isRunning, isPaused, workMinutes]);

  function playAlert() {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.12;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // no-op: audio might be blocked by browser
    }
  }

  const currentCourse = useMemo(
    () => courses.find((c) => c.id.toString() === courseId),
    [courses, courseId]
  );

  const phaseTotalSec = (phase === "work" ? workMinutes : breakMinutes) * 60;
  const progressPct =
    phaseTotalSec > 0 ? ((phaseTotalSec - remainingSec) / phaseTotalSec) * 100 : 0;

  const canStart = courseId.length > 0 && !isRunning;
  const canEnd = isRunning || isPaused;

  function handleStart() {
    if (!courseId) return;
    setLastSaved(null);
    setPhase("work");
    setRemainingSec(workMinutes * 60);
    setTotalWorkSec(0);
    setTotalBreakSec(0);
    setStartedAt(new Date());
    setIsRunning(true);
    setIsPaused(false);
  }

  function handlePause() {
    setIsRunning(false);
    setIsPaused(true);
  }

  function handleResume() {
    setIsRunning(true);
    setIsPaused(false);
  }

  function handleEnd() {
    if (!canEnd) return;
    const endedAt = new Date();
    setIsRunning(false);
    setIsPaused(false);
    const totalWorkMinutes = Math.max(0, Math.round(totalWorkSec / 60));
    const totalBreakMinutes = Math.max(0, Math.round(totalBreakSec / 60));

    startTransition(async () => {
      if (!startedAt) return;
      const { points } = await endStudySessionAction({
        courseId: parseInt(courseId, 10),
        workMinutes,
        breakMinutes,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        totalWorkMinutes,
        totalBreakMinutes,
      });
      setLastSaved({
        minutes: totalWorkMinutes,
        points,
        courseLabel: currentCourse ? currentCourse.code : "Course",
      });
    });
  }

  if (courses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-[#2a2028]">Personal Study Session</h2>
        </div>
        <p className="text-sm text-[rgba(42,32,40,0.45)]">
          Enroll in a course to start a Pomodoro study session.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#2a2028]">Personal Study Session</h2>
          <p className="text-xs text-[rgba(42,32,40,0.45)]">
            Pomodoro cycles with custom timing. Points = work minutes.
          </p>
        </div>
        {lastSaved && (
          <div className="text-xs bg-[#f8f6f4] border border-[rgba(0,0,0,0.05)] rounded-lg px-3 py-2">
            Saved {lastSaved.minutes} min · +{lastSaved.points} pts · {lastSaved.courseLabel}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <label className="block text-xs font-medium text-[rgba(42,32,40,0.6)]">
            Course
          </label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            disabled={isRunning || isPaused}
            className="w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.1)] text-sm text-[#2a2028] bg-[#f8f6f4] focus:outline-none focus:border-[#c2708a] transition-colors disabled:opacity-60"
          >
            <option value="" disabled>
              Select a course
            </option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} — {course.title}
              </option>
            ))}
          </select>

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
                disabled={isRunning || isPaused}
                onChange={(e) =>
                  setWorkMinutes(clampInt(parseInt(e.target.value, 10), 1, 180))
                }
                className="w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.1)] text-sm text-[#2a2028] bg-[#f8f6f4] focus:outline-none focus:border-[#c2708a] transition-colors disabled:opacity-60"
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
                disabled={isRunning || isPaused}
                onChange={(e) =>
                  setBreakMinutes(clampInt(parseInt(e.target.value, 10), 1, 60))
                }
                className="w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.1)] text-sm text-[#2a2028] bg-[#f8f6f4] focus:outline-none focus:border-[#c2708a] transition-colors disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            {!isRunning && !isPaused && (
              <button
                onClick={handleStart}
                disabled={!canStart}
                className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-60"
              >
                Start Session
              </button>
            )}

            {isRunning && (
              <button
                onClick={handlePause}
                className="flex-1 px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.12)] text-sm font-medium text-[#2a2028] hover:bg-[#f8f6f4] transition-all"
              >
                Pause
              </button>
            )}

            {isPaused && (
              <button
                onClick={handleResume}
                className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-sm font-medium hover:opacity-90 transition-all"
              >
                Resume
              </button>
            )}

            {canEnd && (
              <button
                onClick={handleEnd}
                disabled={isPending}
                className="flex-1 px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.12)] text-sm font-medium text-[#2a2028] hover:bg-[#f8f6f4] transition-all disabled:opacity-60"
              >
                {isPending ? "Saving..." : "End Session"}
              </button>
            )}
          </div>
        </div>

        <div className="bg-[#f8f6f4] rounded-2xl p-4 border border-[rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[rgba(42,32,40,0.45)]">
              {phase === "work" ? "Work Interval" : "Break Interval"}
            </span>
            <span className="text-xs text-[rgba(42,32,40,0.4)]">
              {isRunning ? "Running" : isPaused ? "Paused" : "Ready"}
            </span>
          </div>

          <div className="text-3xl font-bold text-[#2a2028] tabular-nums mb-2">
            {formatTime(remainingSec)}
          </div>

          <div className="h-2 bg-white/70 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-[rgba(42,32,40,0.55)]">
            <div className="bg-white rounded-lg border border-[rgba(0,0,0,0.05)] p-3">
              <p className="font-semibold text-[#2a2028]">{Math.round(totalWorkSec / 60)} min</p>
              <p>Work logged</p>
            </div>
            <div className="bg-white rounded-lg border border-[rgba(0,0,0,0.05)] p-3">
              <p className="font-semibold text-[#2a2028]">{Math.round(totalBreakSec / 60)} min</p>
              <p>Break logged</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
