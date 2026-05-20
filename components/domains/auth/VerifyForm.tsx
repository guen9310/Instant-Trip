"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Clock, RefreshCcw } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/client/auth-client";
import { Button } from "@/components/commons/Button";
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

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain || user.length <= 2) return email;
  return `${user.slice(0, 2)}**@${domain}`;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}분 ${sec.toString().padStart(2, "0")}초`;
}

const OTP_TTL = 300; // 5분 (better-auth emailOTP 기본값)

export function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [seconds, setSeconds] = useState(OTP_TTL);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
    reValidateMode: "onSubmit",
  });

  const codeValue = useWatch({ control, name: "code" });

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
      router.push("/feed");
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
      setSeconds(OTP_TTL);
    } catch {
      setError("code", { message: "재발송에 실패했어요. 다시 시도해 주세요." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col">
      <header className="px-3 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          type="button"
          onClick={() => router.push("/sign-in")}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-text-secondary"
        >
          <ArrowLeft size={22} />
        </button>
      </header>
      <div className="flex flex-1 flex-col justify-center px-5 py-10">
        <h1 className="mb-2 text-[24px] font-bold tracking-tight text-text-primary">
          코드를 입력해주세요
        </h1>
        <p className="mb-8 text-[14px] text-text-secondary">
          <span className="font-medium text-text-primary">
            {maskEmail(email)}
          </span>{" "}
          으로 보낸 6자리 코드
        </p>

        <div className="mb-5 flex justify-between">
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <InputOTP
                maxLength={6}
                value={field.value}
                onChange={field.onChange}
                containerClassName="w-full justify-between"
              >
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPGroup key={index}>
                    <InputOTPSlot
                      index={index}
                      className={cn(
                        "h-[56px] w-[46px] rounded-[10px] bg-card text-[22px] font-bold tabular-nums",
                        "border-[1.5px] first:rounded-l-[10px] last:rounded-r-[10px] first:border-l-[1.5px]",
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

        {errors.code ? (
          <p className="text-[13px] text-red-500">{errors.code.message}</p>
        ) : (
          <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
            <Clock size={14} />
            <span>
              {seconds > 0
                ? `${formatTime(seconds)} 후 만료`
                : "코드가 만료됐어요"}
            </span>
          </div>
        )}
      </div>

      <div
        className={cn(
          "border-t border-border bg-background",
          "flex flex-col gap-2",
          "px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4",
        )}
      >
        <Button
          type="submit"
          size="cta"
          disabled={codeValue?.length < 6 || isSubmitting}
        >
          {isSubmitting ? "확인 중..." : "확인"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="cta"
          onClick={handleResend}
          disabled={isSending}
          className="h-[52px] font-medium"
        >
          <RefreshCcw size={15} className="mr-2" />
          {isSending ? "발송 중..." : "코드 재발송"}
        </Button>
      </div>
    </form>
  );
}
