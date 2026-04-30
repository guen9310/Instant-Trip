import { create } from "zustand";

interface ChatState {
  roomId: string | null;
  setRoomId: (id: string | null) => void;
  // TODO: 추후 필요한 채팅 관련 전역 상태 추가
  typingUsers: string[];
  addTypingUser: (userId: string) => void;
  removeTypingUser: (userId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  roomId: null,
  setRoomId: (id) => set({ roomId: id }),
  typingUsers: [],
  addTypingUser: (userId) =>
    set((state) => ({
      typingUsers: [...state.typingUsers, userId],
    })),
  removeTypingUser: (userId) =>
    set((state) => ({
      typingUsers: state.typingUsers.filter((id) => id !== userId),
    })),
}));
