"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/client/authClient";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 30;

// 이메일 OTP 로그인 흐름 — 코드 발송/재발송/검증 서버 액션 호출과 관련 상태(이메일·코드·
// 카운트다운·에러)를 한데 묶는다. 발송 성공 후 코드 입력창에 포커스를 주는 건 DOM ref가
// 필요한 화면 층의 일이라 onSuccess 콜백으로 넘긴다(useStartCourse.ts의 onError 콜백 패턴과 동일).
export function useSignInOtp() {
  const router = useRouter();

  const [email, setEmailState] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCodeState] = useState("");
  const [countdown, setCountdown] = useState(0);
  // sendCode(최초 발송)·verify(로그인)가 공유하는 상태 — 하단 CTA 버튼의 문구/비활성화를 구동한다.
  const [submitting, setSubmitting] = useState(false);
  // resendCode 전용 상태 — submitting과 분리하지 않으면 재전송 중에 하단 CTA가
  // "로그인 중..."으로 잘못 바뀐다(재전송은 별도 버튼의 동작이라 그 버튼만 반응해야 함).
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const emailValid = EMAIL_RE.test(email);
  const codeComplete = code.length === 6;

  const setEmail = (value: string) => {
    setEmailState(value);
    setError(null);
  };

  const setCode = (value: string) => {
    setCodeState(value);
    if (error) setError(null);
  };

  const startCountdown = () => {
    setCountdown(RESEND_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const sendCode = async (onSuccess?: () => void) => {
    if (!emailValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (err) {
        setError("코드 발송에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      setCodeSent(true);
      startCountdown();
      onSuccess?.();
    } catch {
      setError("네트워크 연결을 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const resendCode = async (onSuccess?: () => void) => {
    if (countdown > 0 || resending || submitting) return;
    setResending(true);
    setError(null);
    try {
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (err) {
        setError("재발송에 실패했어요. 다시 시도해 주세요.");
        return;
      }
      setCodeState("");
      startCountdown();
      onSuccess?.();
    } catch {
      setError("네트워크 연결을 확인해주세요.");
    } finally {
      setResending(false);
    }
  };

  const verify = async () => {
    if (!codeComplete || submitting || resending) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: err } = await authClient.signIn.emailOtp({
        email,
        otp: code,
      });
      if (err) {
        setError(
          err.code === "OTP_EXPIRED"
            ? "코드가 만료됐어요. 재발송해 주세요."
            : err.code === "TOO_MANY_ATTEMPTS"
              ? "시도 횟수를 초과했어요. 재발송해 주세요."
              : "코드가 올바르지 않아요.",
        );
        setCodeState("");
        return;
      }
      router.push(data?.user?.onboardingDone ? "/" : "/onboarding");
    } catch {
      // authClient는 정상적으로는 throw하지 않고 {data,error}를 반환하지만,
      // 네트워크 단절 등 fetch 자체가 실패하는 경우를 대비한 최후 방어선 —
      // 이게 없으면 setSubmitting(false)가 실행되지 않아 버튼이 영구히
      // "로그인 중..."에 멈춘다.
      setError("네트워크 연결을 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (codeSent) {
      setCodeSent(false);
      setCodeState("");
      setError(null);
    } else {
      router.back();
    }
  };

  return {
    email,
    setEmail,
    code,
    setCode,
    codeSent,
    countdown,
    submitting,
    resending,
    error,
    emailValid,
    codeComplete,
    sendCode,
    resendCode,
    verify,
    goBack,
  };
}
