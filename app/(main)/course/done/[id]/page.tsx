import { CourseDoneView } from "@/components/domains/course/CourseDoneView";

export default async function DoneCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // URL의 코스 ID — 완료 화면은 이 코스와 일치하는 로컬 진행 기록만 읽는다.
  return <CourseDoneView courseId={id} />;
}
