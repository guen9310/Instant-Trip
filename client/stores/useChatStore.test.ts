import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "./useChatStore";

describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      roomId: null,
      typingUsers: [],
    });
  });

  it("채팅 스토어 초기값을 테스트한다.", () => {
    const state = useChatStore.getState();
    expect(state.roomId).toBeNull();
    expect(state.typingUsers).toEqual([]);
  });

  it("채팅방 아이디를 변경한다.", () => {
    useChatStore.getState().setRoomId("room-123");
    expect(useChatStore.getState().roomId).toBe("room-123");

    useChatStore.getState().setRoomId(null);
    expect(useChatStore.getState().roomId).toBeNull();
  });

  it("타이핑 유저를 추가하고 제거한다.", () => {
    useChatStore.getState().addTypingUser("user-1");
    expect(useChatStore.getState().typingUsers).toContain("user-1");

    useChatStore.getState().addTypingUser("user-2");
    expect(useChatStore.getState().typingUsers).toEqual(["user-1", "user-2"]);

    useChatStore.getState().removeTypingUser("user-1");
    expect(useChatStore.getState().typingUsers).toEqual(["user-2"]);
  });
});
