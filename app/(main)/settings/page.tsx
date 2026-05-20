import { redirect } from "next/navigation";
import { SettingsView } from "@/components/domains/settings/SettingsView";
import { getSession } from "@/server/session";
import { DEFAULT_PREFS, type Prefs } from "@/shared/constants/preferences";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const { prefTravel, prefParty, prefVibe, prefFood, prefIndoor } = session.user;
  const initialPrefs: Prefs = {
    travel: (prefTravel ?? DEFAULT_PREFS.travel) as Prefs["travel"],
    party:  (prefParty  ?? DEFAULT_PREFS.party)  as Prefs["party"],
    vibe:   (prefVibe   ?? DEFAULT_PREFS.vibe)   as Prefs["vibe"],
    food:   (prefFood   ?? DEFAULT_PREFS.food)   as Prefs["food"],
    indoor: (prefIndoor ?? DEFAULT_PREFS.indoor) as Prefs["indoor"],
  };

  return <SettingsView initialPrefs={initialPrefs} />;
}
