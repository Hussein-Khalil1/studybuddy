import { describe, expect, it } from "vitest";
import { getDisposedGroups, respondToInvite } from "./groupService";
import type { GroupInvite, User } from "./types";

describe("respondToInvite", () => {
  it("merges recipient into sender group and disposes old group", () => {
    const users: User[] = [
      { id: "u1", name: "A", groupNumber: 7, courses: ["CS101"] },
      { id: "u2", name: "B", groupNumber: 3, courses: ["CS101"] },
    ];

    const invite: GroupInvite = {
      id: "i1",
      fromUserId: "u1",
      toUserId: "u2",
      newGroupNumber: 7,
      status: "pending",
      createdAt: Date.now(),
    };

    const updated = respondToInvite(invite, true, users);
    const recipient = updated.find((user) => user.id === "u2");

    expect(recipient?.groupNumber).toBe(7);
    expect(updated.some((user) => user.groupNumber === 3)).toBe(false);
    expect(getDisposedGroups()).toContain(3);
  });
});
