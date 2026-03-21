"use client";

import { useMemo, useState, useTransition } from "react";
import { requestToJoinGroupAction, sendGroupInviteAction } from "@/app/actions/group-setup-actions";

type ClassmateOption = {
  id: string;
  username: string;
  hasGroup: boolean;
  pending: boolean;
};

export function CourseGroupActions({
  courseId,
  classmates,
}: {
  courseId: number;
  classmates: ClassmateOption[];
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [pendingTargetIds, setPendingTargetIds] = useState(() => new Set(classmates.filter((row) => row.pending).map((row) => row.id)));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const classmateById = useMemo(() => {
    const map = new Map<string, ClassmateOption>();
    for (const row of classmates) {
      map.set(row.id, row);
    }
    return map;
  }, [classmates]);

  const selectedClassmate = selectedUserId ? classmateById.get(selectedUserId) ?? null : null;
  const selectedHasPending = selectedUserId.length > 0 && pendingTargetIds.has(selectedUserId);

  function markPending(userId: string) {
    setPendingTargetIds((current) => {
      const next = new Set(current);
      next.add(userId);
      return next;
    });
  }

  function onInviteToGroup() {
    if (!selectedClassmate || selectedClassmate.hasGroup || selectedHasPending || isPending) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await sendGroupInviteAction({ courseId, targetUserId: selectedClassmate.id });
      if (!result.ok) {
        setError(result.error ?? "Unable to send invite.");
        return;
      }

      markPending(selectedClassmate.id);
    });
  }

  function onRequestToJoin() {
    if (!selectedClassmate || !selectedClassmate.hasGroup || selectedHasPending || isPending) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await requestToJoinGroupAction({ courseId, targetUserId: selectedClassmate.id });
      if (!result.ok) {
        setError(result.error ?? "Unable to send join request.");
        return;
      }

      markPending(selectedClassmate.id);
    });
  }

  if (classmates.length === 0) {
    return <p className="mt-3 text-sm text-slate-600">No classmates available in this course yet.</p>;
  }

  return (
    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
      <label className="block text-sm font-medium text-slate-700" htmlFor={`group-target-${courseId}`}>
        Select classmate username
      </label>
      <select
        id={`group-target-${courseId}`}
        value={selectedUserId}
        onChange={(event) => {
          setSelectedUserId(event.target.value);
          setError(null);
        }}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
      >
        <option value="">Choose a username</option>
        {classmates.map((classmate) => (
          <option key={classmate.id} value={classmate.id}>
            {classmate.username}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRequestToJoin}
          disabled={!selectedClassmate || !selectedClassmate.hasGroup || selectedHasPending || isPending}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {selectedHasPending ? "Request sent" : isPending ? "Sending..." : "Request to join"}
        </button>

        <button
          type="button"
          onClick={onInviteToGroup}
          disabled={!selectedClassmate || selectedClassmate.hasGroup || selectedHasPending || isPending}
          className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {selectedHasPending ? "Request sent" : isPending ? "Sending..." : "Invite to group"}
        </button>
      </div>

      {selectedClassmate ? (
        <p className="text-xs text-slate-500">
          {selectedClassmate.hasGroup
            ? "This classmate is already in a group, so you can request to join."
            : "This classmate is not in a group, so you can invite them to yours."}
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
