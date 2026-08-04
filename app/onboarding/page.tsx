import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/domains/onboarding/OnboardingForm";
import { getAuthState } from "@/server/session";

export default async function OnboardingPage() {
  const authState = await getAuthState();
  // 세션이 실제로 무효화된 경우(만료·삭제)만 배너와 함께 로그인 화면으로 보낸다.
  // anonymous는 proxy.ts가 이미 걸러내므로 여기선 별도 처리하지 않는다.
  if (authState.status === "invalid_session") {
    redirect("/sign-in?reason=session_expired");
  }
  if (authState.status === "authenticated" && authState.session.user.onboardingDone) {
    redirect("/");
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <OnboardingForm />
    </div>
  );
}
