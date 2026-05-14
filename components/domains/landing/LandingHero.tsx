import Link from "next/link";
import { Shuffle, MapPin, Navigation, CalendarDays, Route } from "lucide-react";
import { buttonVariants } from "@/components/commons/Button";
import { cn } from "@/shared/utils";

export function LandingHero() {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 flex flex-col gap-4">
      {/* Hero 카드 */}
      <div className="rounded-2xl border border-border bg-surface px-5 pt-7 pb-6 flex flex-col">
        <div className="inline-flex self-start items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-primary/8 text-primary text-[11px] font-semibold mb-4">
          <Shuffle size={12} />
          즉흥 여행 코스
        </div>
        <h1 className="text-[30px] font-extrabold text-text-primary tracking-[-0.03em] leading-[1.15] mb-3 text-balance">
          시간이 나는 순간,<br />바로 떠나세요
        </h1>
        <p className="text-[13px] text-text-secondary leading-[1.55] mb-5">
          오늘 갑자기 비어버린 두 시간. 지금 이 자리에서 떠날 수 있는 코스를 만들어드릴게요.
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://picsum.photos/seed/hero/800/600"
          alt=""
          className="w-full rounded-xl object-cover aspect-4/3 mb-5"
        />

        <div className="flex flex-col gap-1">
          <Link href="/start" className={cn(buttonVariants({ size: "cta" }))}>
            지금 시작하기
          </Link>
          <Link
            href="/feed"
            className="py-3 text-[14px] font-medium text-text-secondary text-center"
          >
            코스 둘러보기
          </Link>
        </div>
      </div>

      {/* 프로세스 카드 */}
      <div className="rounded-2xl border border-border bg-surface px-5 pt-6 pb-5 flex flex-col gap-4">
        <h2 className="text-[16px] font-bold text-text-primary tracking-tight">
          이렇게 코스를 만들어요
        </h2>
        <div className="flex flex-col gap-4">
          {[
            {
              icon: MapPin,
              title: "지금 영업 중인 곳 확인",
              desc: "닫힌 곳, 오늘 쉬는 곳은 처음부터 제외해요",
            },
            {
              icon: CalendarDays,
              title: "오늘 열리는 행사 우선 반영",
              desc: "근처 축제나 이벤트가 있으면 코스에 포함해드려요",
            },
            {
              icon: Route,
              title: "최적 동선으로 코스 완성",
              desc: "이동 시간을 고려해 자연스러운 순서로 정리해드려요",
            },
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/8 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <step.icon size={15} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-text-primary leading-snug">
                  {step.title}
                </p>
                <p className="text-[12px] text-text-secondary leading-relaxed mt-0.5">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 거절 기능 카드 */}
      <div className="rounded-2xl border border-border bg-surface px-5 pt-6 pb-5 flex flex-col">
        <div className="mb-4">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-2 bg-primary/8 text-primary">
            <Navigation size={18} strokeWidth={2.2} />
          </div>
          <h2 className="text-[18px] font-bold text-text-primary tracking-[-0.02em] leading-tight">
            마음에 안 들면 거절하세요
          </h2>
          <p className="text-[13px] text-text-secondary leading-[1.55] mt-1">
            한 곳만 빼거나 코스 전체를 다시 뽑을 수 있어요.
          </p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://picsum.photos/seed/feature03/800/500"
          alt=""
          className="w-full rounded-xl object-cover aspect-video"
        />
      </div>

      <div className="h-2" />
    </div>
  );
}
