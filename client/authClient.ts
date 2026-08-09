"use client"

import { createAuthClient } from "better-auth/client"
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins"
import type { auth } from "@/server/auth"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "",
  plugins: [emailOTPClient(), inferAdditionalFields<typeof auth>()],
})

export type { Session, User } from "@/server/auth"
