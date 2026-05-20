import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { emailOTP } from "better-auth/plugins"
import { nextCookies } from "better-auth/next-js"
import { Resend } from "resend"
import { db } from "./db"
import * as schema from "./schema"

export const auth = betterAuth({

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    camelCase: true, // TS 키가 camelCase이므로 (emailVerified, prefTravel 등)
  }),

  user: {
    additionalFields: {
      prefTravel:     { type: "string",  defaultValue: "walk",  required: false, input: true },
      prefParty:      { type: "string",  defaultValue: "solo",  required: false, input: true },
      prefVibe:       { type: "string",  defaultValue: "quiet", required: false, input: true },
      prefFood:       { type: "string",  defaultValue: "matjip",required: false, input: true },
      prefIndoor:     { type: "string",  defaultValue: "indoor",required: false, input: true },
      onboardingDone: { type: "boolean", defaultValue: false,   required: false, input: true },
    },
  },

  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "noreply@example.com",
          to: email,
          subject: "지금어때 로그인 코드",
          html: `<p>인증 코드: <b>${otp}</b></p><p>5분 이내에 입력해 주세요.</p>`,
        })
      },
    }),
    nextCookies(), // 반드시 마지막
  ],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
