"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, RefreshCcw } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/commons/Button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/commons/InputOtp";
import { cn } from "@/shared/utils";
import { useRouter } from "next/navigation";

const schema = z.object({
  code: z.string().length(6),
});

type FormValues = z.infer<typeof schema>;

export function VerifyForm() {
  const router = useRouter();
  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
    mode: "onChange",
  });

  const onSubmit = (_data: FormValues) => {
    // TODO: Verify code
    if (false) {
      router.push("/feed");
    } else {
      router.push("/onboarding");
    }
  };

  const handleResend = () => {
    // TODO: Resend code
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center px-5 py-10">
        <h1 className="mb-2 text-[24px] font-bold tracking-tight text-text-primary">
          코드를 입력해주세요
        </h1>
        <p className="mb-8 text-[14px] text-text-secondary">
          <span className="font-medium text-text-primary">ex**@email.com</span>{" "}
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
                render={({ slots }) => (
                  <>
                    {slots.map((slot, index) => (
                      <InputOTPGroup key={index}>
                        <InputOTPSlot
                          index={index}
                          className={cn(
                            "h-[56px] w-[46px] rounded-[10px] bg-card text-[22px] font-bold tabular-nums",
                            "border-[1.5px] border-border first:rounded-l-[10px] last:rounded-r-[10px] first:border-l-[1.5px]",
                            slot.char ? "border-primary" : "border-border",
                          )}
                        />
                      </InputOTPGroup>
                    ))}
                  </>
                )}
              />
            )}
          />
        </div>

        <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
          <Clock size={14} />
          <span>4분 32초 후 만료</span>
        </div>
      </div>

      <div
        className={cn(
          "border-t border-border bg-background",
          "flex flex-col gap-2",
          "px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4",
        )}
      >
        <Button type="submit" size="cta" disabled={!isValid}>
          확인
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="cta"
          onClick={handleResend}
          className="h-[52px] font-medium"
        >
          <RefreshCcw size={15} className="mr-2" />
          코드 재발송
        </Button>
      </div>
    </form>
  );
}
