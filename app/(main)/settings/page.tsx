import { redirect } from "next/navigation";
import { SettingsView } from "@/components/domains/settings/SettingsView";
import { getSession } from "@/server/session";
import { toPrefs } from "@/server/prefs";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  return <SettingsView initialPrefs={toPrefs(session.user)} />;
}
