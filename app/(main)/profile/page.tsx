import { redirect } from "next/navigation";
import { ProfileView } from "@/components/domains/profile/ProfileView";
import { getSession } from "@/server/session";
import { toPrefs } from "@/server/prefs";
import { getActiveCourse, getCompletedCourses } from "@/server/queries";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [inProgress, completed] = await Promise.all([
    getActiveCourse(session.user.id),
    getCompletedCourses(session.user.id),
  ]);

  return (
    <ProfileView
      user={session.user}
      prefs={toPrefs(session.user)}
      inProgress={inProgress}
      completed={completed}
    />
  );
}
