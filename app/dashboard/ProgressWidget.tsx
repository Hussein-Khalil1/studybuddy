"use client";

import { useState, useTransition } from "react";
import { addAssignmentAction, upsertProgressAction } from "@/app/actions/assignment-actions";

type Member = {
  user_id: string;
  username: string;
  progress: number | null;
  note: string | null;
};

type Assignment = {
  id: number;
  title: string;
  due_date: string | null;
  course_id: number;
  group_id: number;
  course_code: string;
  members: Member[];
};

type GroupOption = {
  group_id: number;
  course_code: string;
  course_title: string;
};

type Props = {
  assignments: Assignment[];
  groups: GroupOption[];
  currentUserId: string;
};

type ModalState =
  | { type: "add" }
  | { type: "update"; assignment: Assignment };

const AVATAR_COLORS = [
  "bg-[#c2708a]",
  "bg-[#9b6ba5]",
  "bg-[#d4956a]",
  "bg-[rgba(42,32,40,0.4)]",
];

export default function ProgressWidget({ assignments, groups, currentUserId }: Props) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sliderValue, setSliderValue] = useState(0);

  function openUpdate(assignment: Assignment) {
    const myMember = assignment.members.find((m) => m.user_id === currentUserId);
    setSliderValue(myMember?.progress ?? 0);
    setModal({ type: "update", assignment });
  }

  function handleAddSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await addAssignmentAction(formData);
      setModal(null);
    });
  }

  function handleUpdateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await upsertProgressAction(formData);
      setModal(null);
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#2a2028]">Progress</h2>
        {groups.length > 0 && (
          <button
            onClick={() => setModal({ type: "add" })}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white hover:opacity-90 transition-all"
          >
            + Add Assignment
          </button>
        )}
      </div>

      {/* Empty state */}
      {assignments.length === 0 && (
        <div className="text-center py-8">
          <div className="text-3xl mb-2">📚</div>
          <p className="text-sm text-[rgba(42,32,40,0.45)]">No assignments yet.</p>
          {groups.length > 0 && (
            <p className="text-xs text-[rgba(42,32,40,0.35)] mt-1">Click "+ Add Assignment" to get started.</p>
          )}
        </div>
      )}

      {/* Assignments list */}
      <div className="space-y-3">
        {assignments.map((assignment) => {
          const myMember = assignment.members.find((m) => m.user_id === currentUserId);
          const myProgress = myMember?.progress ?? 0;

          return (
            <div
              key={assignment.id}
              onClick={() => openUpdate(assignment)}
              className="bg-white rounded-xl border border-[rgba(0,0,0,0.07)] p-4 cursor-pointer hover:border-[rgba(194,112,138,0.3)] hover:shadow-sm transition-all"
            >
              {/* Card header */}
              <div className="flex items-start gap-2 flex-wrap mb-2">
                <span className="text-xs font-semibold text-[#c2708a] bg-[rgba(194,112,138,0.1)] px-2 py-0.5 rounded-full">
                  {assignment.course_code}
                </span>
                {assignment.due_date && (
                  <span className="text-xs text-[rgba(42,32,40,0.45)]">
                    Due {new Date(assignment.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-[#2a2028] mb-3">{assignment.title}</p>

              {/* My progress bar */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-[rgba(42,32,40,0.45)]">Your progress</span>
                  <span className="text-xs font-semibold text-[#c2708a]">{myProgress}%</span>
                </div>
                <div className="h-1.5 bg-[rgba(0,0,0,0.08)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] rounded-full transition-all"
                    style={{ width: `${myProgress}%` }}
                  />
                </div>
              </div>

              {/* Group members row */}
              {assignment.members.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {assignment.members.map((member, idx) => (
                    <div key={member.user_id} className="flex items-center gap-1">
                      <div
                        className={`w-6 h-6 rounded-full ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} text-white flex items-center justify-center text-xs font-semibold`}
                      >
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-[rgba(42,32,40,0.55)]">
                        {member.progress !== null ? `${member.progress}%` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.07)] p-6 w-full max-w-md mx-4 shadow-xl">
            {/* Add Assignment Modal */}
            {modal.type === "add" && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-[#2a2028]">Add Assignment</h3>
                  <button
                    onClick={() => setModal(null)}
                    className="text-[rgba(42,32,40,0.4)] hover:text-[#2a2028] transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleAddSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[rgba(42,32,40,0.65)] mb-1.5">
                      Assignment Title
                    </label>
                    <input
                      name="title"
                      type="text"
                      required
                      placeholder="e.g. Chapter 5 Problem Set"
                      className="w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.1)] text-sm text-[#2a2028] bg-[#f8f6f4] focus:outline-none focus:border-[#c2708a] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[rgba(42,32,40,0.65)] mb-1.5">
                      Group
                    </label>
                    <select
                      name="group_id"
                      required
                      className="w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.1)] text-sm text-[#2a2028] bg-[#f8f6f4] focus:outline-none focus:border-[#c2708a] transition-colors"
                    >
                      {groups.map((g) => (
                        <option key={g.group_id} value={g.group_id}>
                          {g.course_code} — {g.course_title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[rgba(42,32,40,0.65)] mb-1.5">
                      Due Date <span className="text-[rgba(42,32,40,0.35)]">(optional)</span>
                    </label>
                    <input
                      name="due_date"
                      type="date"
                      className="w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.1)] text-sm text-[#2a2028] bg-[#f8f6f4] focus:outline-none focus:border-[#c2708a] transition-colors"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setModal(null)}
                      className="flex-1 px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] text-sm font-medium text-[rgba(42,32,40,0.65)] hover:bg-[#f2eeec] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-60"
                    >
                      {isPending ? "Saving..." : "Add Assignment"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* Update Progress Modal */}
            {modal.type === "update" && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#c2708a] bg-[rgba(194,112,138,0.1)] px-2 py-0.5 rounded-full">
                        {modal.assignment.course_code}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-[#2a2028]">{modal.assignment.title}</h3>
                  </div>
                  <button
                    onClick={() => setModal(null)}
                    className="text-[rgba(42,32,40,0.4)] hover:text-[#2a2028] transition-colors shrink-0"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleUpdateSubmit} className="space-y-4">
                  <input type="hidden" name="assignment_id" value={modal.assignment.id} />
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium text-[rgba(42,32,40,0.65)]">
                        Your Progress
                      </label>
                      <span className="text-sm font-bold text-[#c2708a]">{sliderValue}%</span>
                    </div>
                    <input
                      name="progress"
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={sliderValue}
                      onChange={(e) => setSliderValue(parseInt(e.target.value, 10))}
                      className="w-full accent-[#c2708a]"
                    />
                    <div className="flex justify-between text-xs text-[rgba(42,32,40,0.35)] mt-1">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[rgba(42,32,40,0.65)] mb-1.5">
                      Note <span className="text-[rgba(42,32,40,0.35)]">(optional)</span>
                    </label>
                    <textarea
                      name="note"
                      rows={3}
                      maxLength={500}
                      defaultValue={modal.assignment.members.find((m) => m.user_id === currentUserId)?.note ?? ""}
                      placeholder="Add a note for your groupmates..."
                      className="w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.1)] text-sm text-[#2a2028] bg-[#f8f6f4] focus:outline-none focus:border-[#c2708a] transition-colors resize-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setModal(null)}
                      className="flex-1 px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] text-sm font-medium text-[rgba(42,32,40,0.65)] hover:bg-[#f2eeec] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-60"
                    >
                      {isPending ? "Saving..." : "Save Progress"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
