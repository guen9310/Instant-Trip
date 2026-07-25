import { CoursePreviewClient } from "@/components/domains/course/CoursePreviewClient";
import { getSession } from "@/server/session";
import { getActiveCourse } from "@/server/queries";

export default async function CoursePreviewPage() {
  const session = await getSession();
  // "여기로 갈게요" 탭 시 기존에 진행 중인 외출이 있으면 사용자에게 확인을 받기 위해 미리 조회한다.
  const activeCourse = session?.user
    ? await getActiveCourse(session.user.id)
    : null;

  return (
    <CoursePreviewClient
      isAuthenticated={!!session?.user}
      activeCourse={activeCourse}
    />
  );
}
