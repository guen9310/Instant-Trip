import { CoursePreviewClient } from "@/components/domains/course/CoursePreviewClient";
import { getAuthState } from "@/server/session";
import { getActiveCourse } from "@/server/queries";

export default async function CoursePreviewPage() {
  const authState = await getAuthState();
  const isAuthenticated = authState.status === "authenticated";
  // "여기로 갈게요" 탭 시 기존에 진행 중인 외출이 있으면 사용자에게 확인을 받기 위해 미리 조회한다.
  const activeCourse = isAuthenticated
    ? await getActiveCourse(authState.session.user.id)
    : null;

  return (
    <CoursePreviewClient
      isAuthenticated={isAuthenticated}
      // proxy.ts가 /course를 보호 경로로 걸러내므로, 이 페이지에 도달했는데 미인증이면
      // 그건 세션이 서버에서 무효화된 경우(invalid_session)뿐이다 — anonymous는 여기 오지 못한다.
      sessionExpired={authState.status === "invalid_session"}
      activeCourse={activeCourse}
    />
  );
}
