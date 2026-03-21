"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessageAction } from "./send-message-action";

type Message = {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
};

type Member = {
  id: string;
  username: string;
};

// Groups consecutive messages from the same sender together
type MsgGroup = {
  user_id: string;
  username: string;
  isMe: boolean;
  items: { id: number; content: string; created_at: string }[];
};

function buildGroups(messages: Message[], currentUserId: string, memberMap: Map<string, string>): MsgGroup[] {
  const groups: MsgGroup[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last.user_id === msg.user_id) {
      last.items.push({ id: msg.id, content: msg.content, created_at: msg.created_at });
    } else {
      groups.push({
        user_id: msg.user_id,
        username: msg.user_id === currentUserId ? "You" : (memberMap.get(msg.user_id) ?? "Student"),
        isMe: msg.user_id === currentUserId,
        items: [{ id: msg.id, content: msg.content, created_at: msg.created_at }],
      });
    }
  }
  return groups;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dateSeparatorLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (msgDay.getTime() === today.getTime()) return "Today";
  if (msgDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// Insert date separators between groups that span different days
type ChatItem =
  | { type: "separator"; label: string; key: string }
  | { type: "group"; group: MsgGroup; key: string };

function buildChatItems(groups: MsgGroup[]): ChatItem[] {
  const items: ChatItem[] = [];
  let lastDate = "";
  for (const group of groups) {
    const firstMsg = group.items[0];
    const day = new Date(firstMsg.created_at).toDateString();
    if (day !== lastDate) {
      lastDate = day;
      items.push({ type: "separator", label: dateSeparatorLabel(firstMsg.created_at), key: `sep-${day}` });
    }
    items.push({ type: "group", group, key: `grp-${firstMsg.id}` });
  }
  return items;
}

const AVATAR_BG = ["bg-[#c2708a]", "bg-[#9b6ba5]", "bg-[#d4956a]", "bg-[rgba(42,32,40,0.4)]"];

export function ChatBox({
  groupId,
  currentUserId,
  initialMessages,
  members,
}: {
  groupId: number;
  currentUserId: string;
  initialMessages: Message[];
  members: Member[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const memberMap = new Map(members.map((m) => [m.id, m.username]));
  const memberColorMap = new Map(members.map((m, i) => [m.id, AVATAR_BG[i % AVATAR_BG.length]]));

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function onTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    autoResize(e.target);
  }

  function onSend() {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;

    setError(null);
    const optimisticMsg: Message = {
      id: Date.now(), // temporary
      user_id: currentUserId,
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    startTransition(async () => {
      const result = await sendMessageAction({ groupId, content: trimmed });
      if (!result.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setText(trimmed);
        setError(result.error ?? "Failed to send.");
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  const groups = buildGroups(messages, currentUserId, memberMap);
  const chatItems = buildChatItems(groups);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-16">
            <div className="text-4xl">👋</div>
            <p className="text-sm font-medium text-[#2a2028]">No messages yet</p>
            <p className="text-xs text-[rgba(42,32,40,0.45)]">Be the first to say hello!</p>
          </div>
        ) : (
          chatItems.map((item) => {
            if (item.type === "separator") {
              return (
                <div key={item.key} className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-[rgba(0,0,0,0.06)]" />
                  <span className="text-xs text-[rgba(42,32,40,0.35)] font-medium px-1">{item.label}</span>
                  <div className="flex-1 h-px bg-[rgba(0,0,0,0.06)]" />
                </div>
              );
            }

            const { group } = item;
            const avatarColor = memberColorMap.get(group.user_id) ?? AVATAR_BG[0];

            return (
              <div
                key={item.key}
                className={`flex gap-2 items-end ${group.isMe ? "flex-row-reverse" : "flex-row"} mb-1`}
              >
                {/* Avatar — shown once per group, aligned to bottom */}
                {!group.isMe && (
                  <div
                    className={`w-7 h-7 rounded-full ${avatarColor} text-white flex items-center justify-center text-xs font-bold shrink-0 mb-0.5`}
                  >
                    {group.username.charAt(0).toUpperCase()}
                  </div>
                )}
                {group.isMe && <div className="w-7 shrink-0" />}

                {/* Bubble stack */}
                <div className={`flex flex-col gap-0.5 max-w-[70%] ${group.isMe ? "items-end" : "items-start"}`}>
                  {/* Sender name — only for others, only once per group */}
                  {!group.isMe && (
                    <span className="text-xs font-semibold text-[rgba(42,32,40,0.55)] mb-0.5 ml-1">
                      {group.username}
                    </span>
                  )}

                  {group.items.map((msg, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === group.items.length - 1;

                    // Rounded corners like iMessage: top corners square for continuation
                    const bubbleRadius = group.isMe
                      ? `rounded-2xl ${isFirst ? "rounded-tr-md" : ""} ${isLast ? "" : "rounded-br-md"}`
                      : `rounded-2xl ${isFirst ? "rounded-tl-md" : ""} ${isLast ? "" : "rounded-bl-md"}`;

                    return (
                      <div key={msg.id} className={`flex flex-col ${group.isMe ? "items-end" : "items-start"}`}>
                        <div
                          className={[
                            "px-3.5 py-2 text-sm leading-relaxed break-words",
                            bubbleRadius,
                            group.isMe
                              ? "bg-gradient-to-br from-[#c2708a] to-[#9b6ba5] text-white"
                              : "bg-white border border-[rgba(0,0,0,0.08)] text-[#2a2028]",
                          ].join(" ")}
                        >
                          {msg.content}
                        </div>
                        {/* Timestamp on last bubble of group */}
                        {isLast && (
                          <span className="text-[10px] text-[rgba(42,32,40,0.3)] mt-0.5 mx-1">
                            {formatTime(msg.created_at)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <p className="px-4 pb-1 text-xs text-rose-500 text-right">{error}</p>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-[rgba(0,0,0,0.07)] px-4 py-3 flex items-end gap-3 bg-white">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          placeholder="Message…"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-[rgba(0,0,0,0.1)] bg-[#f8f6f4] px-4 py-2.5 text-sm text-[#2a2028] outline-none transition focus:border-[#c2708a] placeholder:text-[rgba(42,32,40,0.35)]"
          style={{ maxHeight: 120, overflowY: "auto" }}
        />
        <button
          type="button"
          disabled={!text.trim() || isPending}
          onClick={onSend}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c2708a] to-[#9b6ba5] text-white flex items-center justify-center transition hover:opacity-90 disabled:opacity-40 shrink-0"
          aria-label="Send"
        >
          {/* Send arrow icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
