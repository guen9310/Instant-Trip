"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/commons/Button";
import { Input } from "@/components/commons/Input";
import { cn } from "@/shared/utils";

const schema = z.object({
  email: z.string().email(),
});

type FormValues = z.infer<typeof schema>;

export function SignInForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const onSubmit = (_data: FormValues) => {
    // TODO: 인증 코드 발송 처리
    console.log(_data);
    router.push("/sign-in/verify");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center px-5 py-10">
        <div
          className={cn(
            "mb-5 flex h-14 w-14 items-center justify-center rounded-2xl",
            "bg-primary/10 text-primary",
          )}
        >
          <Sparkles size={26} strokeWidth={2.2} />
        </div>

        <h1 className="mb-2 text-[26px] font-bold tracking-tight text-text-primary">
          시작하기
        </h1>
        <p className="mb-7 text-[14px] leading-relaxed text-text-secondary">
          이메일로 인증 코드를 보내드릴게요
        </p>

        <label
          htmlFor="email"
          className="mb-1.5 text-[12px] font-semibold text-text-secondary"
        >
          이메일
        </label>
        <div
          className={cn(
            "flex h-[52px] items-center gap-2 rounded-[8px] px-3.5",
            "border border-border bg-card",
            "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
            "transition-all duration-150",
          )}
        >
          <Mail size={18} className="shrink-0 text-text-secondary" />
          <Input
            id="email"
            type="email"
            placeholder="you@email.com"
            autoComplete="email"
            className={cn(
              "h-full flex-1 border-none bg-transparent p-0 text-[15px] text-text-primary",
              "placeholder:text-text-secondary/60",
              "focus-visible:ring-0 focus-visible:border-none",
            )}
            {...register("email")}
          />
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-text-secondary">
          처음이어도 괜찮아요. 계정이 없으면 자동으로 만들어드려요.
        </p>
      </div>

      <div
        className={cn(
          "border-t border-border bg-background",
          "px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4",
        )}
      >
        <Button type="submit" size="cta" disabled={!isValid}>
          인증 코드 받기
        </Button>
      </div>
    </form>
  );
}
