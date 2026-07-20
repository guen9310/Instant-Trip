"use client";

import { useState, useEffect } from "react";
import { Route } from "lucide-react";

const MESSAGES = [
  "지금 영업 중인 곳을 확인하는 중...",
  "오늘 열리는 행사를 찾는 중...",
  "최적의 동선을 계산하는 중...",
];

export function CourseLoadingOverlay() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [dotIdx, setDotIdx] = useState(0);

  useEffect(() => {
    const m = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 1200);
    const d = setInterval(() => setDotIdx((i) => (i + 1) % 3), 400);
    return () => {
      clearInterval(m);
      clearInterval(d);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background gap-6">
      <style>{`
        @keyframes zat-ring {
          0% { transform: scale(0.6); opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
      <div className="relative w-[120px] h-[120px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute inset-0 rounded-full border-2 border-primary"
            style={{ animation: `zat-ring 1.6s ease-out ${i * 0.5}s infinite` }}
          />
        ))}
        <div className="absolute inset-6 rounded-full bg-primary flex items-center justify-center">
          <Route size={32} className="text-white" strokeWidth={2} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-[16px] font-bold text-text-primary tracking-tight mb-2">
          지금 갈 만한 곳을 찾고 있어요
        </p>
        <p className="text-[13px] text-text-secondary">{MESSAGES[msgIdx]}</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-accent transition-opacity duration-200"
            style={{ opacity: i === dotIdx ? 1 : 0.25 }}
          />
        ))}
      </div>
    </div>
  );
}
