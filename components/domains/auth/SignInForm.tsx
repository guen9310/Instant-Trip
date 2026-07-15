"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle, Compass, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/client/auth-client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 30;

export function SignInForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const emailValid = EMAIL_RE.test(email);
  const codeComplete = code.length === 6;

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

  const sendCode = async () => {
    if (!emailValid || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setSubmitting(false);
    if (err) {
      setError("코드 발송에 실패했어요. 다시 시도해 주세요.");
      return;
    }
    setCodeSent(true);
    startCountdown();
    setTimeout(() => codeRef.current?.focus(), 480);
  };

  const resendCode = async () => {
    if (countdown > 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setSubmitting(false);
    if (err) {
      setError("재발송에 실패했어요. 다시 시도해 주세요.");
      return;
    }
    setCode("");
    startCountdown();
    setTimeout(() => codeRef.current?.focus(), 100);
  };

  const verify = async () => {
    if (!codeComplete || submitting) return;
    setSubmitting(true);
    setError(null);
    const { data, error: err } = await authClient.signIn.emailOtp({
      email,
      otp: code,
    });
    setSubmitting(false);
    if (err) {
      setError(
        err.code === "OTP_EXPIRED"
          ? "코드가 만료됐어요. 재발송해 주세요."
          : err.code === "TOO_MANY_ATTEMPTS"
            ? "시도 횟수를 초과했어요. 재발송해 주세요."
            : "코드가 올바르지 않아요.",
      );
      setCode("");
      return;
    }
    router.push(data?.user?.onboardingDone ? "/" : "/onboarding");
  };

  const goBack = () => {
    if (codeSent) {
      setCodeSent(false);
      setCode("");
      setError(null);
    } else {
      router.back();
    }
  };

  const activeBtnStyle: React.CSSProperties = {
    background: "var(--auth-btn-active)",
    color: "var(--auth-btn-text)",
    boxShadow: "var(--auth-btn-shadow)",
    cursor: "pointer",
  };

  const disabledBtnStyle: React.CSSProperties = {
    background: "var(--auth-btn-disabled-bg)",
    color: "var(--auth-btn-disabled-fg)",
    cursor: "default",
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center px-4">
        <button
          type="button"
          onClick={goBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary"
        >
          <ArrowLeft size={22} />
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 flex-col justify-center overflow-y-auto px-7">
        {/* Brand mark */}
        <div
          className="mb-8 flex h-18 w-18 shrink-0 items-center justify-center"
          style={{
            borderRadius: "20px",
            background:
              "linear-gradient(160deg, var(--auth-brand-from), var(--auth-brand-to))",
            border: "1px solid var(--auth-brand-border)",
            boxShadow: "0 8px 24px rgba(0,0,0,.35)",
          }}
        >
          <Compass
            size={34}
            strokeWidth={2}
            style={{ color: "var(--auth-icon-brand)" }}
          />
        </div>

        {/* Title — text morphs when stage changes */}
        <h1
          className="mb-2 font-bold text-text-primary"
          style={{ fontSize: "34px", letterSpacing: "-0.5px" }}
        >
          {codeSent ? "본인 확인" : "시작하기"}
        </h1>

        {/* Subtitle — text morphs when stage changes */}
        <p
          className="mb-8 text-[16px] leading-relaxed"
          style={{ color: "var(--auth-text-subtitle)" }}
        >
          {codeSent
            ? "메일로 보낸 6자리 코드를 입력하면 로그인돼요."
            : "이메일로 인증 코드를 보내드릴게요"}
        </p>

        {/* ── Stage 1: Email block ── */}
        <div
          className="overflow-hidden"
          style={{
            maxHeight: codeSent ? "0px" : "200px",
            opacity: codeSent ? 0 : 1,
            transition:
              "max-height .4s cubic-bezier(.22,.61,.36,1), opacity .25s",
          }}
        >
          <label
            htmlFor="auth-email"
            className="mb-1.5 block font-medium"
            style={{ fontSize: "15px", color: "var(--auth-text-label)" }}
          >
            이메일
          </label>
          <div
            className="flex h-14.5 items-center gap-3 px-4 transition-[border-color] duration-150"
            style={{
              borderRadius: "14px",
              background: "var(--auth-surface)",
              border: `1.5px solid ${
                emailFocused ? "var(--auth-focus)" : "var(--auth-border-input)"
              }`,
            }}
          >
            <Mail
              size={20}
              strokeWidth={2}
              className="shrink-0"
              style={{ color: "var(--auth-icon-input)" }}
            />
            <input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              placeholder="you@email.com"
              className="auth-email-input flex-1 bg-transparent text-[15px] text-text-primary outline-none"
            />
          </div>
          {error && !codeSent ? (
            <p className="mt-3 text-[13px] text-destructive">{error}</p>
          ) : (
            <p
              className="mt-3 leading-relaxed"
              style={{ fontSize: "13.5px", color: "var(--auth-text-helper)" }}
            >
              처음이어도 괜찮아요. 계정이 없으면 자동으로 만들어드려요.
            </p>
          )}
        </div>

        {/* ── Stage 2: Verify block ── */}
        <div
          className="overflow-hidden"
          style={{
            maxHeight: codeSent ? "380px" : "0px",
            opacity: codeSent ? 1 : 0,
            transform: codeSent ? "translateY(0)" : "translateY(10px)",
            transition:
              "max-height .55s cubic-bezier(.22,.61,.36,1), opacity .4s ease .1s, transform .5s",
          }}
        >
          {/* Email confirm chip — click to return to email step */}
          <button
            type="button"
            onClick={goBack}
            className="flex w-full items-center gap-3 px-3.5 py-2.75"
            style={{
              borderRadius: "14px",
              background: "var(--auth-surface-chip)",
              border: "1px solid var(--auth-border-chip)",
            }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center"
              style={{
                borderRadius: "11px",
                background: "var(--auth-surface-icon)",
              }}
            >
              <Mail
                size={17}
                strokeWidth={2}
                style={{ color: "var(--auth-icon-chip)" }}
              />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p
                className="truncate font-medium"
                style={{ fontSize: "15.5px", color: "var(--auth-text-email)" }}
              >
                {email}
              </p>
              <div className="mt-0.5 flex items-center gap-1">
                <CheckCircle size={11} style={{ color: "var(--auth-success)" }} />
                <span style={{ fontSize: "12.5px", color: "var(--auth-success)" }}>
                  이 이메일로 전송됨
                </span>
              </div>
            </div>
            <span
              className="shrink-0 cursor-pointer"
              style={{ fontSize: "13.5px", color: "var(--auth-text-change)" }}
            >
              변경
            </span>
          </button>

          {/* OTP 6-box input */}
          <div
            className="relative mt-7 flex cursor-pointer gap-2.5"
            onClick={() => codeRef.current?.focus()}
          >
            {Array.from({ length: 6 }).map((_, i) => {
              const filled = i < code.length;
              const cursor = otpFocused && i === code.length && code.length < 6;
              return (
                <div
                  key={i}
                  className="flex flex-1 items-center justify-center font-semibold text-text-primary"
                  style={{
                    height: "62px",
                    borderRadius: "15px",
                    fontSize: "27px",
                    background: filled
                      ? "var(--auth-otp-filled-bg)"
                      : "var(--auth-surface)",
                    border: `1.5px solid ${
                      cursor
                        ? "var(--auth-cursor)"
                        : filled
                          ? "var(--auth-focus)"
                          : "var(--auth-border-otp)"
                    }`,
                    boxShadow: cursor ? "var(--auth-cursor-shadow)" : undefined,
                  }}
                >
                  {code[i] ?? ""}
                </div>
              );
            })}
            {/* Hidden input captures keystrokes; tapping the box area focuses it */}
            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(val);
                if (error) setError(null);
              }}
              onFocus={() => setOtpFocused(true)}
              onBlur={() => setOtpFocused(false)}
              autoComplete="one-time-code"
              aria-label="6자리 인증 코드"
              className="absolute left-0 top-0 h-px w-px opacity-0"
            />
          </div>

          {/* Resend */}
          <div className="mt-5 flex items-center justify-center gap-1.5">
            <span style={{ fontSize: "14px", color: "var(--auth-text-helper)" }}>
              코드를 못 받으셨나요?
            </span>
            <button
              type="button"
              onClick={resendCode}
              disabled={countdown > 0 || submitting}
              className="font-medium transition-colors"
              style={{
                fontSize: "14px",
                color:
                  countdown > 0
                    ? "var(--auth-resend-disabled)"
                    : "var(--auth-resend-active)",
              }}
            >
              {countdown > 0 ? `...${countdown}초 후` : "코드 재전송"}
            </button>
          </div>

          {error && codeSent && (
            <p className="mt-3 text-center text-[13px] text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Bottom fixed button */}
      <div className="shrink-0 px-5 pb-7 pt-4">
        <button
          type="button"
          onClick={codeSent ? verify : sendCode}
          disabled={
            codeSent ? !codeComplete || submitting : !emailValid || submitting
          }
          className="h-14.5 w-full text-[16px] font-semibold"
          style={{
            borderRadius: "15px",
            ...(codeSent
              ? codeComplete && !submitting
                ? activeBtnStyle
                : disabledBtnStyle
              : emailValid && !submitting
                ? activeBtnStyle
                : disabledBtnStyle),
          }}
        >
          {codeSent
            ? submitting
              ? "로그인 중..."
              : "로그인"
            : submitting
              ? "발송 중..."
              : "인증 코드 받기"}
        </button>
      </div>
    </div>
  );
}
