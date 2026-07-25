import { CourseActiveView } from "@/components/domains/course/CourseActiveView";
import { getSession } from "@/server/session";
import { getResumableCourse } from "@/server/queries";

export default async function ActiveCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  // localStorage의 pendingCourse가 없을 때(다른 기기·저장소 초기화 등)를 위한 서버 측 대비책 —
  // 프로필 "이어서"가 가리키는 courseId(DB courses.id)로 복원 가능한지 미리 조회해둔다.
  const dbFallback = session?.user
    ? await getResumableCourse(session.user.id, id)
    : null;

  return <CourseActiveView courseId={id} dbFallback={dbFallback} />;
}
