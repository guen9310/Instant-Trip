import { redirect } from "next/navigation";
import { SettingsView } from "@/components/domains/settings/SettingsView";
import { getFreshSession } from "@/server/session";
import { toPrefs } from "@/server/prefs";

export default async function SettingsPage() {
  const session = await getFreshSession();
  if (!session) redirect("/sign-in");

  return <SettingsView initialPrefs={toPrefs(session.user)} />;
}
