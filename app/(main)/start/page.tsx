import { redirect } from "next/navigation";
import { StartView } from "@/components/domains/start/StartView";
import { getSession } from "@/server/session";
import { toPrefs } from "@/server/prefs";

export default async function StartPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  // 코스 생성에 쓰는 취향은 DB가 진실의 출처 — 서버에서 읽어 prop으로 주입한다
  return <StartView prefs={toPrefs(session.user)} />;
}
