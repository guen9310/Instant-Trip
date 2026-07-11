import { Suspense } from "react";
import { VerifyForm } from "@/components/domains/auth/VerifyForm";

export default function VerifyPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <Suspense>
        <VerifyForm />
      </Suspense>
    </div>
  );
}
