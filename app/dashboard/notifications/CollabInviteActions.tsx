"use client";

import { useTransition } from "react";
import { acceptCollabInviteAction, declineCollabInviteAction } from "@/app/actions/collab-session-actions";

export default function CollabInviteActions({ inviteId }: { inviteId: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={() => startTransition(() => acceptCollabInviteAction({ inviteId }))}
        disabled={isPending}
        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-60"
      >
        Join
      </button>
      <button
        onClick={() => startTransition(() => declineCollabInviteAction({ inviteId }))}
        disabled={isPending}
        className="px-3 py-1.5 rounded-lg border border-[rgba(0,0,0,0.12)] text-xs font-semibold text-[#2a2028] hover:bg-[#f8f6f4] transition disabled:opacity-60"
      >
        Decline
      </button>
    </div>
  );
}
