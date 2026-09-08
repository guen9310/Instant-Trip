import { CourseActiveView } from "@/components/domains/course/CourseActiveView";
import { getAuthState } from "@/server/session";
import { getResumableCourse } from "@/server/queries";

export default async function ActiveCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authState = await getAuthState();
  // localStorage의 pendingCourse가 없을 때(다른 기기·저장소 초기화 등)를 위한 서버 측 대비책 —
  // 프로필 "이어서"가 가리키는 courseId(DB courses.id)로 복원 가능한지 미리 조회해둔다.
  const dbFallback =
    authState.status === "authenticated"
      ? await getResumableCourse(authState.session.user.id, id)
      : null;

  return (
    <CourseActiveView
      courseId={id}
      dbFallback={dbFallback}
      // proxy.ts가 /course를 보호 경로로 걸러내므로, 이 페이지에 도달했는데 미인증이면
      // 그건 세션이 서버에서 무효화된 경우(invalid_session)뿐이다 — anonymous는 여기 오지 못한다.
      sessionExpired={authState.status === "invalid_session"}
    />
  );
}
