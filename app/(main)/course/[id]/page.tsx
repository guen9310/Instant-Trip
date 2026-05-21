import { CourseResultView } from "@/components/domains/course/CourseResultView";
import { MOCK_PLACES } from "@/shared/constants/courseMock";

export default function CoursePage({ params }: { params: { id: string } }) {
  // TODO: params.id로 실제 코스 데이터 fetch로 교체
  return (
    <CourseResultView
      courseId={params.id}
      courseName="적당히 즐기는 코스"
      places={MOCK_PLACES}
    />
  );
}
