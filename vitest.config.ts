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
