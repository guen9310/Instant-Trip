import { CourseActiveView } from "@/components/domains/course/CourseActiveView";

export default async function ActiveCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CourseActiveView courseId={id} />;
}
