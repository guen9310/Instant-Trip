import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/domains/onboarding/OnboardingForm";
import { getSession } from "@/server/session";

export default async function OnboardingPage() {
  const session = await getSession();
  if (session?.user?.onboardingDone) {
    redirect("/");
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <OnboardingForm />
    </div>
  );
}
