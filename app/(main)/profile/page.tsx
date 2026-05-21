import { redirect } from "next/navigation";
import { ProfileView } from "@/components/domains/profile/ProfileView";
import { getSession } from "@/server/session";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  // TODO: API 연결 후 실제 데이터로 교체
  return (
    <ProfileView
      user={session.user}
      inProgress={null}
      completed={[]}
    />
  );
}
