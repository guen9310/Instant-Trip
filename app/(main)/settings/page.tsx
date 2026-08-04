import { redirect } from "next/navigation";
import { SettingsView } from "@/components/domains/settings/SettingsView";
import { getFreshAuthState } from "@/server/session";
import { toPrefs } from "@/server/prefs";

export default async function SettingsPage() {
  const authState = await getFreshAuthState();
  if (authState.status === "invalid_session") redirect("/sign-in?reason=session_expired");
  if (authState.status === "anonymous") redirect("/sign-in");

  return <SettingsView initialPrefs={toPrefs(authState.session.user)} />;
}
