import { http, HttpResponse } from "msw";

export const handlers = [
  // 채팅방 목록 모킹 예시
  http.get("/api/chat/rooms", () => {
    return HttpResponse.json([
      { id: "1", name: "General" },
      { id: "2", name: "Travel Tips" },
    ]);
  }),

  // 메시지 전송 모킹 예시
  http.post("/api/chat/rooms/:roomId/messages", async ({ request }) => {
    const newMessage = await request.json();
    return HttpResponse.json({
      id: "msg_" + Date.now(),
      ...(newMessage as object),
      createdAt: new Date().toISOString(),
    });
  }),
];
