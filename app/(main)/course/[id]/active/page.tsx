import { CourseActiveView } from "@/components/domains/course/CourseActiveView";

export default function ActiveCoursePage({ params }: { params: { id: string } }) {
  return <CourseActiveView courseId={params.id} />;
}
