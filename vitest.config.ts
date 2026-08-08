import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '.env.local') });

// lib/tour/client.ts·server/db.ts가 모듈 로드 시점에 즉시 평가하는 값들 —
// 실제 API를 부르는 pipeline-diagnostic.test.ts는 제외돼 있으므로 나머지
// 테스트는 진짜 키 없이도 통과해야 한다(.env.local 없는 CI·새 클론 환경 대응).
process.env.TOUR_API_KEY ??= 'dummy-tour-api-key';
process.env.DATABASE_URL ??= 'postgresql://dummy:dummy@localhost:5432/dummy';

// CI(ubuntu-latest)는 TZ 미지정 시 UTC로 돈다. 이 프로젝트는 KST(Asia/Seoul) 전용 서비스라
// 테스트 코드 곳곳(lib/tour/hours.test.ts 등)이 오프셋 없는 로컬 Date 리터럴("2026-08-06T16:00:00")을
// "그 시각의 KST"로 가정한다 — 런타임 TZ를 고정하지 않으면 로컬(Asia/Seoul)에선 통과하고
// CI(UTC)에선 요일·시각이 어긋나 실패한다. 프로덕션 코드 자체는 이 값에 의존하지 않는다
// (shared/utils/kst.ts, lib/tour/hours.ts 모두 Intl로 Asia/Seoul을 명시해 서버 TZ와 무관하게 동작함) —
// 이 TZ 고정은 순수하게 테스트 결정성·로컬-CI 일치를 위한 것이다.
process.env.TZ = 'Asia/Seoul';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    // 실제 외부 API(TourAPI, Kakao)를 호출하는 수동 진단 테스트 — pnpm test:diagnostic으로 별도 실행
    exclude: [...configDefaults.exclude, 'tests/unit/pipeline-diagnostic.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
