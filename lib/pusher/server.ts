import Pusher from "pusher";
import { getPusherServerConfig } from "./env";

export type CourseEventType =
  | "invite.sent"
  | "invite.accepted"
  | "invite.declined"
  | "group.member_count_changed";

export type CourseEventPayload = {
  type: CourseEventType;
  courseId: number;
  groupId?: number;
  requestId?: number;
  fromUserId?: string;
  targetUserId?: string;
  memberCount?: number;
};

let pusherSingleton: Pusher | null | undefined;

function getPusherServer() {
  if (pusherSingleton !== undefined) {
    return pusherSingleton;
  }

  const config = getPusherServerConfig();
  if (!config) {
    pusherSingleton = null;
    return pusherSingleton;
  }

  pusherSingleton = new Pusher({
    appId: config.appId,
    key: config.key,
    secret: config.secret,
    cluster: config.cluster,
    useTLS: true,
  });

  return pusherSingleton;
}

export async function triggerCourseEvent(payload: CourseEventPayload) {
  const pusher = getPusherServer();
  if (!pusher) {
    return;
  }

  await pusher.trigger(`course-${payload.courseId}`, "group-setup-updated", payload);
}
