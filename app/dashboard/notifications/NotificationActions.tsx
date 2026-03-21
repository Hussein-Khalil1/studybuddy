"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToGroupInviteAction } from "@/app/dashboard/course/[courseId]/group-setup-actions";

type Props = {
  requestId: number;
  courseId: number;
  groupId?: number;
};

export default function NotificationActions({ requestId, courseId, groupId }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handle(decision: "accept" | "decline") {
    startTransition(async () => {
      const result = await respondToGroupInviteAction({ requestId, courseId, decision });
      if (result.ok && decision === "accept") {
        const gId = result.groupId ?? groupId;
        const cId = result.courseId ?? courseId;
        if (gId && cId) {
          router.push(`/dashboard/course/${cId}/group/${gId}`);
        } else {
          router.push("/dashboard/messages");
        }
      }
    });
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={() => handle("accept")}
        disabled={isPending}
        className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#c2708a] to-[#9b6ba5] text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {isPending ? "Joining..." : "Accept"}
      </button>
      <button
        onClick={() => handle("decline")}
        disabled={isPending}
        className="px-4 py-1.5 rounded-lg border border-[rgba(0,0,0,0.1)] text-[rgba(42,32,40,0.65)] text-xs font-medium hover:bg-[#f2eeec] transition disabled:opacity-50"
      >
        Decline
      </button>
    </div>
  );
}
