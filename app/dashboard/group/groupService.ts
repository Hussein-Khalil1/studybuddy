import type { GroupInvite, User } from "./types";

const userGroupLookup = new Map<string, number>();
const disposedGroups = new Set<number>();
const messageLog: Array<{ fromId: string; toId: string; text: string; createdAt: number }> = [];

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `invite_${Math.random().toString(36).slice(2)}`;
}

function hasCourseOverlap(a: string[], b: string[]) {
  const pool = new Set(a);
  return b.some((course) => pool.has(course));
}

export function registerUsers(users: User[]) {
  userGroupLookup.clear();
  for (const user of users) {
    userGroupLookup.set(user.id, user.groupNumber);
  }
}

export function getDisposedGroups() {
  return Array.from(disposedGroups);
}

export function getMessageLog() {
  return [...messageLog];
}

export function findPeers(currentUser: User, allUsers: User[]) {
  return allUsers.filter((user) => {
    if (user.id === currentUser.id) return false;
    if (user.groupNumber === currentUser.groupNumber) return false;
    return hasCourseOverlap(currentUser.courses, user.courses);
  });
}

export function sendMessage(fromId: string, toId: string, text: string) {
  if (!text.trim()) {
    throw new Error("Message text cannot be empty.");
  }
  messageLog.push({ fromId, toId, text: text.trim(), createdAt: Date.now() });
}

export function sendInvite(fromId: string, toId: string): GroupInvite {
  const newGroupNumber = userGroupLookup.get(fromId);
  if (typeof newGroupNumber !== "number") {
    throw new Error("Unknown sender group. Register users before sending invites.");
  }

  return {
    id: randomId(),
    fromUserId: fromId,
    toUserId: toId,
    newGroupNumber,
    status: "pending",
    createdAt: Date.now(),
  };
}

export function respondToInvite(invite: GroupInvite, accept: boolean, allUsers: User[]) {
  if (!accept || invite.status !== "pending") {
    return allUsers;
  }

  const recipient = allUsers.find((user) => user.id === invite.toUserId);
  if (!recipient) {
    return allUsers;
  }

  const oldGroupNumber = recipient.groupNumber;
  const updatedUsers = allUsers.map((user) =>
    user.id === invite.toUserId ? { ...user, groupNumber: invite.newGroupNumber } : user,
  );

  if (!updatedUsers.some((user) => user.groupNumber === oldGroupNumber)) {
    disposedGroups.add(oldGroupNumber);
  }

  registerUsers(updatedUsers);
  return updatedUsers;
}
