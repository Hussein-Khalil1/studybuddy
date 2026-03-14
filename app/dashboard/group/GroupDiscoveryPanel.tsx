"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { List } from "react-window";
import type { ListProps } from "react-window";
import { PeerCard } from "./PeerCard";
import { GroupStoreProvider, useGroupStore } from "./useGroupStore";
import type { User } from "./types";

const InviteCard = dynamic(() => import("./InviteCard").then((module) => module.InviteCard), {
  ssr: false,
  loading: () => <div className="h-[92px] rounded-xl border border-slate-200 bg-white/70" />,
});

type Tab = "peers" | "sent" | "received";
const FixedSizeList = List;

function PanelContent() {
  const { currentUser, peers, sentInvites, receivedInvites } = useGroupStore();
  const [tab, setTab] = useState<Tab>("peers");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  const sharedByPeer = useMemo(() => new Map(peers.map((peer) => [peer.id, peer.courses.filter((course) => currentUser.courses.includes(course))])), [currentUser.courses, peers]);
  const allSharedCourses = useMemo(() => Array.from(new Set(Array.from(sharedByPeer.values()).flat())).sort(), [sharedByPeer]);
  const filteredPeers = useMemo(() => (selectedCourses.length ? peers.filter((peer) => selectedCourses.every((course) => sharedByPeer.get(peer.id)?.includes(course))) : peers), [peers, selectedCourses, sharedByPeer]);
  const toggleCourse = useCallback((course: string) => setSelectedCourses((current) => (current.includes(course) ? current.filter((item) => item !== course) : [...current, course])), []);

  const rowComponent = useCallback<ListProps<Record<string, never>>["rowComponent"]>(
    ({ index, style }: { index: number; style: CSSProperties }) => {
      const peer = filteredPeers[index];
      if (!peer) return null;
      return (
        <div style={style} className="px-1 py-1">
          <PeerCard peer={peer} sharedCourses={sharedByPeer.get(peer.id) ?? []} />
        </div>
      );
    },
    [filteredPeers, sharedByPeer],
  );

  const tabs: Array<{ id: Tab; label: string }> = [{ id: "peers", label: "Peers" }, { id: "sent", label: "Invites Sent" }, { id: "received", label: "Invites Received" }];

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
      <div className="mb-4 flex gap-2">
        {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-3 py-2 text-sm font-medium focus-visible:ring-2 ring-offset-2 motion-safe:transition-all duration-200 ${tab === item.id ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}>{item.label}</button>)}
      </div>

      {tab === "peers" && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {allSharedCourses.map((course) => <button key={course} onClick={() => toggleCourse(course)} className={`rounded-full border px-2 py-1 text-xs focus-visible:ring-2 ring-offset-2 motion-safe:transition-all duration-200 ${selectedCourses.includes(course) ? "bg-sky-100 text-sky-700 border-sky-300" : "bg-sky-50 text-sky-600 border-sky-200"}`}>{course}</button>)}
          </div>
          {filteredPeers.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">No peers found for the selected course filters.</p> : filteredPeers.length > 20 ? <FixedSizeList rowComponent={rowComponent} rowCount={filteredPeers.length} rowHeight={104} rowProps={{}} style={{ height: 416, width: "100%" }} /> : <div className="space-y-2">{filteredPeers.map((peer) => <PeerCard key={peer.id} peer={peer} sharedCourses={sharedByPeer.get(peer.id) ?? []} />)}</div>}
        </>
      )}

      {tab === "sent" && (sentInvites.length ? <div className="space-y-2">{sentInvites.map((invite) => <InviteCard key={invite.id} invite={invite} variant="sent" />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">No sent invites yet.</p>)}
      {tab === "received" && (receivedInvites.length ? <div className="space-y-2">{receivedInvites.map((invite) => <InviteCard key={invite.id} invite={invite} variant="received" />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">No received invites yet.</p>)}
    </section>
  );
}

export function GroupDiscoveryPanel({ initialUsers, currentUserId }: { initialUsers: User[]; currentUserId: string }) {
  return (
    <GroupStoreProvider initialUsers={initialUsers} currentUserId={currentUserId}>
      <PanelContent />
    </GroupStoreProvider>
  );
}
