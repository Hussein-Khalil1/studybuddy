"use client";

import { useOptimistic, useState, useTransition } from "react";
import { respondToGroupInviteAction } from "@/app/actions/group-setup-actions";

type DecisionState = "pending" | "accepted" | "declined";

export function RespondButton({
  courseId,
  requestId,
}: {
  courseId: number;
  requestId: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimisticState, setOptimisticState] = useOptimistic<DecisionState, DecisionState>(
    "pending",
    (_current, nextState) => nextState,
  );

  function onRespond(decision: "accept" | "decline") {
    if (optimisticState !== "pending" || isPending) return;
    setError(null);
    startTransition(async () => {
      setOptimisticState(decision === "accept" ? "accepted" : "declined");
      const result = await respondToGroupInviteAction({ courseId, requestId, decision });
      if (!result.ok) {
        setOptimisticState("pending");
        setError(result.error ?? "Unable to update invite.");
      }
    });
  }

  if (optimisticState !== "pending") {
    return (
      <p className="text-xs font-medium text-slate-600">
        {optimisticState === "accepted" ? "Accepted" : "Declined"}
      </p>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => onRespond("accept")}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onRespond("decline")}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
        >
          Decline
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
