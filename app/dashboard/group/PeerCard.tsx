"use client";

import Image from "next/image";
import { memo, useMemo, useState } from "react";
import { useGroupStore } from "./useGroupStore";
import type { User } from "./types";

function Avatar({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar) {
    return (
      <Image
        src={avatar}
        alt={name}
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function PeerCardBase({ peer, sharedCourses }: { peer: User; sharedCourses: string[] }) {
  const { currentUser, sendInvite, sendMessage, sentInvites } = useGroupStore();
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const sameGroup = currentUser.groupNumber === peer.groupNumber;
  const inviteAlreadySent = useMemo(() => {
    return sentInvites.some((invite) => invite.toUserId === peer.id && invite.status === "pending");
  }, [peer.id, sentInvites]);

  const inviteDisabled = sameGroup || inviteAlreadySent || sendingInvite;
  const inviteTitle = sameGroup
    ? "Already in your group"
    : inviteAlreadySent
      ? "Invite already sent"
      : "Send invite";

  async function onInvite() {
    setSendingInvite(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    sendInvite(currentUser.id, peer.id);
    setSendingInvite(false);
  }

  async function onMessage() {
    setSendingMessage(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    sendMessage(currentUser.id, peer.id, `Hey ${peer.name}, want to study together?`);
    setSendingMessage(false);
  }

  return (
    <article className="h-24 rounded-xl border border-slate-200 bg-white px-4 py-3 motion-safe:transition-all duration-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={peer.name} avatar={peer.avatar} />
          <div className="min-w-0">
            <p className="truncate font-medium text-sm text-slate-900">{peer.name}</p>
            <p className="text-xs text-gray-500">Group #{peer.groupNumber}</p>
          </div>
          <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">G{peer.groupNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          <button title="Send message" onClick={onMessage} disabled={sendingMessage} className="rounded-lg border border-slate-200 p-2 text-slate-600 focus-visible:ring-2 ring-offset-2 motion-safe:transition-all duration-200 hover:bg-slate-50 disabled:opacity-60">
            {sendingMessage ? "..." : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
            )}
          </button>
          <button title={inviteTitle} onClick={onInvite} disabled={inviteDisabled} className="rounded-lg border border-slate-200 p-2 text-slate-600 focus-visible:ring-2 ring-offset-2 motion-safe:transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
            {sendingInvite ? "..." : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M19 8v6M22 11h-6" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {sharedCourses.map((course) => (
          <span key={`${peer.id}-${course}`} className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-600 border border-sky-200">
            {course}
          </span>
        ))}
      </div>
    </article>
  );
}

export const PeerCard = memo(PeerCardBase);
