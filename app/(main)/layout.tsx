import { GlobalNav } from "@/components/layout/GlobalNav";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { getSession } from "@/server/session";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // getSession()은 better-auth 세션 검증·DB 조회를 거치므로 DB 커넥션 오류 등으로
  // throw될 수 있다. 이 레이아웃은 (main) 그룹 전체(홈·시작·프로필·설정·코스 화면)의
  // 공통 부모라 여기서 예외가 전파되면 앱 전체가 죽는다. 세션 조회 실패는 "로그인 안
  // 한 사용자"와 동일하게 session?.user ?? null로 귀결되는 값이므로, 실패 시에도 같은
  // 폴백(익명 사용자)으로 렌더링하는 편이 에러 화면을 보여주는 것보다 낫다고 판단했다.
  // 이 catch를 우회하는 예기치 못한 예외는 app/error.tsx가 앱 전체 안전망으로 처리한다.
  let session: Awaited<ReturnType<typeof getSession>> = null;
  try {
    session = await getSession();
  } catch (error) {
    console.error("[MainLayout] getSession 실패, 익명 사용자로 폴백", error);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <GlobalNav user={session?.user ?? null} />
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
