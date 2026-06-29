import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '.env.local') });

// 실제 외부 API(TourAPI, Kakao)를 호출하는 수동 진단 테스트 전용 설정 — pnpm test:diagnostic으로 실행
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/unit/pipeline-diagnostic.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
