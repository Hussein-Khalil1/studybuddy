"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  findPeers as findPeersService,
  registerUsers,
  respondToInvite as respondToInviteService,
  sendInvite as sendInviteService,
  sendMessage as sendMessageService,
} from "./groupService";
import type { GroupInvite, User } from "./types";

type GroupStore = {
  currentUser: User;
  peers: User[];
  sentInvites: GroupInvite[];
  receivedInvites: GroupInvite[];
  findPeers: (currentUser: User, allUsers: User[]) => User[];
  sendMessage: (fromId: string, toId: string, text: string) => void;
  sendInvite: (fromId: string, toId: string) => GroupInvite;
  respondToInvite: (invite: GroupInvite, accept: boolean, allUsers: User[]) => User[];
  cancelInvite: (inviteId: string) => void;
};

const GroupStoreContext = createContext<GroupStore | null>(null);

export function GroupStoreProvider({
  children,
  initialUsers,
  currentUserId,
}: {
  children: ReactNode;
  initialUsers: User[];
  currentUserId: string;
}) {
  const [allUsers, setAllUsers] = useState<User[]>(() => {
    if (typeof window === "undefined") {
      return initialUsers;
    }
    return initialUsers.map((user) => {
      const persisted = Number(window.localStorage.getItem(`studybuddy:group-number:${user.id}`));
      if (!Number.isFinite(persisted)) return user;
      return { ...user, groupNumber: persisted };
    });
  });
  const [sentInvites, setSentInvites] = useState<GroupInvite[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<GroupInvite[]>([]);

  const currentUser = useMemo(() => {
    return allUsers.find((user) => user.id === currentUserId) ?? allUsers[0];
  }, [allUsers, currentUserId]);

  const peers = useMemo(() => {
    return currentUser ? findPeersService(currentUser, allUsers) : [];
  }, [allUsers, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const key = `studybuddy:group-number:${currentUser.id}`;
    window.localStorage.setItem(key, String(currentUser.groupNumber));
  }, [currentUser]);

  const findPeers = useCallback((user: User, users: User[]) => findPeersService(user, users), []);

  const sendMessage = useCallback((fromId: string, toId: string, text: string) => {
    sendMessageService(fromId, toId, text);
  }, []);

  const sendInvite = useCallback(
    (fromId: string, toId: string) => {
      registerUsers(allUsers);
      const invite = sendInviteService(fromId, toId);
      setSentInvites((current) => [invite, ...current]);
      setReceivedInvites((current) => [invite, ...current]);
      return invite;
    },
    [allUsers],
  );

  const respondToInvite = useCallback(
    (invite: GroupInvite, accept: boolean, users: User[]) => {
      const updatedUsers = respondToInviteService(invite, accept, users);
      setAllUsers(updatedUsers);
      setReceivedInvites((current) =>
        current.map((row) =>
          row.id === invite.id ? { ...row, status: accept ? "accepted" : "declined" } : row,
        ),
      );
      setSentInvites((current) =>
        current.map((row) =>
          row.id === invite.id ? { ...row, status: accept ? "accepted" : "declined" } : row,
        ),
      );
      return updatedUsers;
    },
    [],
  );

  const cancelInvite = useCallback((inviteId: string) => {
    setSentInvites((current) => current.filter((invite) => invite.id !== inviteId));
    setReceivedInvites((current) => current.filter((invite) => invite.id !== inviteId));
  }, []);

  const value = useMemo<GroupStore>(
    () => ({
      currentUser,
      peers,
      sentInvites,
      receivedInvites,
      findPeers,
      sendMessage,
      sendInvite,
      respondToInvite,
      cancelInvite,
    }),
    [cancelInvite, currentUser, findPeers, peers, receivedInvites, respondToInvite, sendInvite, sendMessage, sentInvites],
  );

  return <GroupStoreContext.Provider value={value}>{children}</GroupStoreContext.Provider>;
}

export function useGroupStore() {
  const value = useContext(GroupStoreContext);
  if (!value) {
    throw new Error("useGroupStore must be used within GroupStoreProvider.");
  }
  return value;
}
