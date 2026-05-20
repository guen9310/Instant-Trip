import { redirect } from "next/navigation";
import { ProfileView } from "@/components/domains/profile/ProfileView";
import { getSession } from "@/server/session";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  return <ProfileView user={session.user} />;
}
