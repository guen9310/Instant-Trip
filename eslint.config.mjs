import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.

  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "docs/**",
    // 에이전트 작업용 git worktree — 다른 브랜치의 전체 사본(빌드 산출물 포함)이라 린트 대상이 아니다.
    ".claude/**",
  ]),
]);

export default eslintConfig;
