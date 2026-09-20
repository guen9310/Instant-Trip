import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { Resend } from "resend";
import { db } from "./db";
import * as schema from "./schema";

const SEND_OTP_PATH = "/email-otp/send-verification-otp";

// 인증 코드 메일 발송에 실패한 이메일(소문자) — 같은 요청의 after 훅이 꺼내 오류 응답으로 바꾼다.
// better-auth(1.6.x)는 sendVerificationOTP가 던진 예외를 로그만 남기고 삼킨 뒤 success:true를
// 응답한다(runInBackgroundOrAwait). 그대로 두면 메일이 안 가도 화면은 "코드를 보냈어요"로
// 넘어가 사용자가 오지 않는 코드를 기다리게 된다.
const failedOtpEmails = new Set<string>();

export const auth = betterAuth({
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "", // 배포 환경
    "http://localhost:3000", // 로컬 환경
  ].filter(Boolean),

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    camelCase: true, // TS 키가 camelCase이므로 (emailVerified, prefTravel 등)
  }),

  user: {
    additionalFields: {
      prefTravel: {
        type: "string",
        defaultValue: "walk",
        required: false,
        input: true,
      },
      prefParty: {
        type: "string",
        defaultValue: "solo",
        required: false,
        input: true,
      },
      prefVibe: {
        type: "string",
        defaultValue: "quiet",
        required: false,
        input: true,
      },
      prefFood: {
        type: "string",
        defaultValue: "matjip",
        required: false,
        input: true,
      },
      prefIndoor: {
        type: "string",
        defaultValue: "indoor",
        required: false,
        input: true,
      },
      onboardingDone: {
        type: "boolean",
        defaultValue: false,
        required: false,
        input: true,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SEND_OTP_PATH) return;
      const body = ctx.body as { email?: unknown } | undefined;
      const email = typeof body?.email === "string" ? body.email.toLowerCase() : "";
      if (!failedOtpEmails.delete(email)) return;
      // 클라이언트(useSignInOtp)는 error가 있으면 "코드 발송에 실패했어요"를 보여주고 재시도하게 한다.
      throw new APIError("BAD_GATEWAY", { message: "인증 코드 메일을 보내지 못했습니다." });
    }),
  },

  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        // Resend SDK는 4xx/5xx 응답에도 reject하지 않고 { error }를 돌려준다 — 직접 확인한다.
        const { error } = await resend.emails
          .send({
            from: process.env.RESEND_FROM_EMAIL ?? "noreply@example.com",
            to: email,
            subject: "지금어때 로그인 코드",
            html: `<p>인증 코드: <b>${otp}</b></p><p>5분 이내에 입력해 주세요.</p>`,
          })
          .catch((err: unknown) => ({ error: err }));
        if (error) {
          failedOtpEmails.add(email.toLowerCase());
          throw new Error(`[auth] 인증 코드 메일 발송 실패: ${JSON.stringify(error)}`);
        }
      },
    }),
    nextCookies(), // 반드시 마지막
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
