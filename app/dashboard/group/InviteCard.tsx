"use client";

import { useState } from "react";
import { useGroupStore } from "./useGroupStore";
import type { GroupInvite } from "./types";

export function InviteCard({ invite, variant }: { invite: GroupInvite; variant: "sent" | "received" }) {
  const { currentUser, peers, respondToInvite, cancelInvite } = useGroupStore();
  const [closing, setClosing] = useState(false);

  const userMap = new Map<string, string>([
    [currentUser.id, currentUser.name],
    ...peers.map((peer) => [peer.id, peer.name] as const),
  ]);

  const fromName = userMap.get(invite.fromUserId) ?? "Student";
  const toName = userMap.get(invite.toUserId) ?? "Student";

  function closeThen(run: () => void) {
    setClosing(true);
    window.setTimeout(run, 200);
  }

  return (
    <article className={`overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 motion-safe:transition-all duration-200 ${closing ? "max-h-0 opacity-0 py-0" : "max-h-24 opacity-100"}`}>
      <p className="font-medium text-sm text-slate-900">
        {variant === "received" ? `${fromName} invited you to join Group #${invite.newGroupNumber}` : `Invite sent to ${toName}`}
      </p>
      <p className="mt-1 text-xs text-gray-500">Status: {invite.status}</p>

      {variant === "received" ? (
        <div className="mt-3 flex gap-2">
          <button onClick={() => closeThen(() => { respondToInvite(invite, true, [currentUser, ...peers]); })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 focus-visible:ring-2 ring-offset-2 motion-safe:transition-all duration-200">
            Accept
          </button>
          <button onClick={() => closeThen(() => { respondToInvite(invite, false, [currentUser, ...peers]); })} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 focus-visible:ring-2 ring-offset-2 motion-safe:transition-all duration-200 hover:bg-slate-50">
            Decline
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Pending</span>
          <button onClick={() => closeThen(() => cancelInvite(invite.id))} className="text-xs font-medium text-slate-600 underline focus-visible:ring-2 ring-offset-2 motion-safe:transition-all duration-200">
            Cancel
          </button>
        </div>
      )}
    </article>
  );
}
