"use client";

import { useOptimistic, useState, useTransition } from "react";
import { sendGroupInviteAction } from "./group-setup-actions";

export function InviteToGroupButton({
  courseId,
  targetUserId,
  initiallyPending,
  disabled,
}: {
  courseId: number;
  targetUserId: string;
  initiallyPending: boolean;
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticPending, setOptimisticPending] = useOptimistic(
    initiallyPending,
    (_state, nextValue: boolean) => nextValue,
  );

  function onInvite() {
    if (disabled || optimisticPending || isPending) {
      return;
    }

    setError(null);
    startTransition(async () => {
      setOptimisticPending(true);
      const result = await sendGroupInviteAction({ courseId, targetUserId });

      if (!result.ok) {
        setOptimisticPending(false);
        setError(result.error ?? "Unable to send invite.");
      }
    });
  }

  const isDisabled = disabled || optimisticPending || isPending;

  return (
    <div>
      <button
        type="button"
        disabled={isDisabled}
        onClick={onInvite}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {disabled ? "Group Full" : optimisticPending ? "Invite sent" : isPending ? "Sending..." : "Invite to group"}
      </button>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
