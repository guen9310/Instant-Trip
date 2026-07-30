import { redirect } from "next/navigation";
import { SignInForm } from "@/components/domains/auth/SignInForm";
import { getFreshSession } from "@/server/session";

export default async function SignInPage() {
  const session = await getFreshSession();
  if (session) redirect("/");

  return (
    <div className="flex h-full flex-col bg-background">
      <SignInForm />
    </div>
  );
}
