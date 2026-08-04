import { redirect } from "next/navigation";
import { ProfileView } from "@/components/domains/profile/ProfileView";
import { getFreshAuthState } from "@/server/session";
import { toPrefs } from "@/server/prefs";
import { getActiveCourse, getCompletedCourses } from "@/server/queries";

export default async function ProfilePage() {
  const authState = await getFreshAuthState();
  if (authState.status === "invalid_session") redirect("/sign-in?reason=session_expired");
  if (authState.status === "anonymous") redirect("/sign-in");

  const { session } = authState;
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
