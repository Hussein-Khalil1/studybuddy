export type User = {
  id: string;
  name: string;
  avatar?: string;
  groupNumber: number;
  courses: string[];
};

export type GroupInvite = {
  id: string;
  fromUserId: string;
  toUserId: string;
  newGroupNumber: number;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
};
