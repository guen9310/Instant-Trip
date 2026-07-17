"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/client/auth-client";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/commons/InputOtp";
import { cn } from "@/shared/utils";

const schema = z.object({
  code: z.string().length(6, "6자리 코드를 입력해주세요."),
});

type FormValues = z.infer<typeof schema>;

export function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [isSending, setIsSending] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
    reValidateMode: "onSubmit",
  });

  const onSubmit = async (data: FormValues) => {
    const { data: result, error } = await authClient.signIn.emailOtp({
      email,
      otp: data.code,
    });
    if (error) {
      reset();
      const message =
        error.code === "OTP_EXPIRED"
          ? "코드가 만료됐어요. 재발송해 주세요."
          : error.code === "TOO_MANY_ATTEMPTS"
            ? "시도 횟수를 초과했어요. 재발송해 주세요."
            : "코드가 올바르지 않아요.";
      setError("code", { message });
      return;
    }
    const user = result?.user;
    if (user?.onboardingDone) {
      router.push("/");
    } else {
      router.push("/onboarding");
    }
  };

  const handleResend = async () => {
    setIsSending(true);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (error) throw error;
      reset();
    } catch {
      setError("code", { message: "재발송에 실패했어요. 다시 시도해 주세요." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card px-6 pb-6 pt-5 shadow-xl">
      <h1 className="mb-2 text-center text-[20px] font-bold text-text-primary">
        본인 확인
      </h1>
      <p className="mb-6 text-center text-[13px] leading-relaxed text-text-secondary">
        저장된 정보를 사용하려면
        <br />
        {email}(으)로 보낸 코드를 입력하십시오.
      </p>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-5">
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <InputOTP
                maxLength={6}
                value={field.value}
                onChange={(val) => {
                  field.onChange(val);
                  if (val.length === 6) handleSubmit(onSubmit)();
                }}
                containerClassName="w-full justify-between"
              >
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPGroup key={index}>
                    <InputOTPSlot
                      index={index}
                      className={cn(
                        "h-14 w-11.5 rounded-[12px] text-[22px] font-bold tabular-nums",
                        "border-[1.5px] first:rounded-l-[12px] last:rounded-r-[12px] first:border-l-[1.5px]",
                        errors.code
                          ? "border-red-500"
                          : field.value[index]
                            ? "border-primary"
                            : "border-border",
                      )}
                    />
                  </InputOTPGroup>
                ))}
              </InputOTP>
            )}
          />
        </div>

        {errors.code && (
          <p className="mb-4 text-center text-[13px] text-red-500">
            {errors.code.message}
          </p>
        )}

        <div className="mb-6 flex justify-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={isSending}
            className="text-[14px] font-medium text-primary disabled:opacity-50"
          >
            {isSending ? "발송 중..." : "코드 재전송"}
          </button>
        </div>
      </form>

      <p className="text-center text-[12px] text-text-secondary">
        {email} 계정으로 로그인하십시오.
      </p>
    </div>
  );
}
