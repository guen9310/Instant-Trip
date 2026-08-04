/**
 * QA 전용 — better-auth 세션을 이메일 OTP 없이 직접 발급한다.
 *
 * 배경: docs/plan/auth-session-state-qa.md의 인증 상태(anonymous/authenticated/
 * invalid_session) 수동 QA는 테스트 대상이 "OTP 발급이 잘 되는가"가 아니라
 * "세션이 유효/무효 상태일 때 getAuthState가 정확히 분기하는가"다. 그런데 시나리오마다
 * 세션을 무효화한 뒤 다음 시나리오를 위해 다시 로그인해야 해서, 매번 이메일 OTP를 반복
 * 확인해야 하는 게 병목이었다. better-auth 공식 testUtils 플러그인(login({userId}))은
 * 실제 로그인 경로(internalAdapter.createSession)를 그대로 써서 진짜로 유효하고 정식
 * 서명된 세션 쿠키를 만들어준다 — 가짜/목업이 아니라 이 앱의 auth.ts가 검증에 쓰는 것과
 * 동일한 BETTER_AUTH_SECRET으로 서명하므로 실제 dev 서버에서 그대로 통한다.
 *
 * ⚠️ userId만으로 자격 증명 확인 없이 유효한 세션을 만들어주는 기능이라, 절대 네트워크로
 * 노출하면 안 된다(API 라우트로 만들지 말 것). 로컬 CLI로만 실행하고, DATABASE_URL·
 * BETTER_AUTH_SECRET에 이미 접근 가능한 사람(=이 리포를 로컬에서 돌릴 수 있는 사람)만
 * 쓸 수 있는 신뢰 경계 안에 둔다.
 *
 * 실행:
 *   pnpm qa:login [email]
 *   기본 이메일: qa@example.com (없으면 새로 생성, 있으면 재사용)
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

if (process.env.NODE_ENV === "production") {
  console.error("[qa-login] 프로덕션 환경에서는 실행할 수 없습니다.");
  process.exit(1);
}

async function main() {
  // DATABASE_URL 등 env 의존 모듈은 dotenv 설정 후 동적 import — home-run.ts와 같은 패턴.
  const { betterAuth } = await import("better-auth");
  const { drizzleAdapter } = await import("better-auth/adapters/drizzle");
  const { testUtils } = await import("better-auth/plugins");
  const { db } = await import("../server/db");
  const schema = await import("../server/schema");

  const email = process.argv[2] ?? "qa@example.com";

  // secret은 명시하지 않음 — 프로덕션 auth.ts와 동일하게 process.env.BETTER_AUTH_SECRET을
  // 기본으로 읽는다. 여기서 다른 secret을 쓰면 서명이 안 맞아 devtools에 붙여넣어도
  // dev 서버가 "invalid_session"으로 판정해버린다(오히려 이 스크립트의 존재 이유를 해침).
  const testAuth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema, camelCase: true }),
    session: { expiresIn: 60 * 60 * 24 * 30 },
    plugins: [testUtils({ captureOTP: true })],
  });

  const ctx = await testAuth.$context;

  const existing = await ctx.internalAdapter.findUserByEmail(email);
  let userId: string;
  if (existing) {
    userId = existing.user.id;
    console.log(`[qa-login] 기존 유저 재사용: ${email} (${userId})`);
  } else {
    const draft = ctx.test.createUser({
      email,
      name: "QA 테스터",
      emailVerified: true,
    });
    const created = await ctx.test.saveUser(draft);
    userId = created.id;
    console.log(`[qa-login] 새 유저 생성: ${email} (${userId})`);
  }

  const { cookies } = await ctx.test.login({ userId });
  const cookie = cookies[0];

  console.log("\n=== devtools → Application → Cookies에 아래 값으로 쿠키를 추가/수정하세요 ===");
  console.log(`Name:     ${cookie.name}`);
  console.log(`Value:    ${cookie.value}`);
  console.log(`Domain:   ${cookie.domain}`);
  console.log(`Path:     ${cookie.path}`);
  console.log(`HttpOnly: ${cookie.httpOnly}`);
  console.log(`SameSite: ${cookie.sameSite}`);
  console.log("========================================================\n");
  console.log(
    "session_data(캐시) 쿠키는 비어 있는 상태로 시작합니다 — 첫 페이지 로드 때 서버가 자동으로 채웁니다.\n" +
      "시나리오 C·E처럼 무효화를 재현하려면 그 뒤 session_data를 지우고 session_token 값을 변형하세요.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[qa-login] 실패:", err);
    process.exit(1);
  });
