import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StartView } from "@/components/domains/start/StartView";
import { getAuthState } from "@/server/session";
import { toPrefs } from "@/server/prefs";

export default async function StartPage() {
  const authState = await getAuthState();
  if (authState.status === "invalid_session") redirect("/sign-in?reason=session_expired");
  if (authState.status === "anonymous") redirect("/sign-in");

  // 코스 생성에 쓰는 취향은 DB가 진실의 출처 — 서버에서 읽어 prop으로 주입한다
  // Suspense: StartView → useGenerateCourse가 useSearchParams()(디버그용 debugWeather
  // 쿼리 파라미터)를 쓴다 — sign-in 페이지와 동일한 컨벤션.
  return (
    <Suspense>
      <StartView prefs={toPrefs(authState.session.user)} />
    </Suspense>
  );
}
