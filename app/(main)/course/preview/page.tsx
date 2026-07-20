import { CoursePreviewClient } from "@/components/domains/course/CoursePreviewClient";
import { getSession } from "@/server/session";

export default async function CoursePreviewPage() {
  const session = await getSession();

  return <CoursePreviewClient isAuthenticated={!!session?.user} />;
}
