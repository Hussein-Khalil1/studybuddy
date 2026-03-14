"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher/client";

type CourseEventPayload = {
  type: "invite.sent" | "invite.accepted" | "invite.declined" | "group.member_count_changed";
  courseId: number;
  targetUserId?: string;
};

export function GroupSetupRealtime({
  courseId,
  currentUserId,
}: {
  courseId: number;
  currentUserId: string;
}) {
  const router = useRouter();
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) {
      return;
    }

    const channelName = `course-${courseId}`;
    const channel = pusher.subscribe(channelName);

    const onEvent = (payload: CourseEventPayload) => {
      if (!payload || payload.courseId !== courseId) {
        return;
      }

      if (payload.type === "invite.sent" && payload.targetUserId === currentUserId) {
        setNotification("New group invite received.");
      }

      router.refresh();
    };

    channel.bind("group-setup-updated", onEvent);

    return () => {
      channel.unbind("group-setup-updated", onEvent);
      pusher.unsubscribe(channelName);
    };
  }, [courseId, currentUserId, router]);

  useEffect(() => {
    if (!notification) {
      return;
    }

    const timer = window.setTimeout(() => setNotification(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notification]);

  if (!notification) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900 shadow-sm">
      {notification}
    </div>
  );
}
