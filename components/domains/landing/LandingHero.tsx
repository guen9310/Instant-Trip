import Link from "next/link";
import { Sparkles, Zap, MapPin, Navigation } from "lucide-react";
import { buttonVariants } from "@/components/commons/Button";
import { cn } from "@/shared/utils";

const features = [
  {
    num: "01",
    icon: Zap,
    title: "결정은 저희가 할게요",
    desc: "시간·날씨·취향에 맞춰 즉석에서 코스를 짜드려요.",
    accent: true,
  },
  {
    num: "02",
    icon: MapPin,
    title: "지금 갈 수 있는 곳만",
    desc: "영업 중인 곳, 지금 가도 늦지 않은 곳만 골라서 추천해드려요.",
    accent: true,
  },
  {
    num: "03",
    icon: Navigation,
    title: "마음에 안 들면 거절하세요",
    desc: "한 곳만 빼거나 코스 전체를 다시 뽑을 수 있어요.",
    accent: false,
  },
];

export function LandingHero() {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 flex flex-col gap-4">
      {/* Hero 카드 */}
      <div className="rounded-2xl border border-border bg-surface px-5 pt-7 pb-6 flex flex-col">
        <div className="inline-flex self-start items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-primary/8 text-primary text-[11px] font-semibold mb-4">
          <Sparkles size={12} />
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

      {/* Feature 카드 목록 */}
      {features.map((feature) => (
        <div
          key={feature.num}
          className="rounded-2xl border border-border bg-surface px-5 pt-6 pb-5 flex flex-col"
        >
          <div className="flex items-start gap-3 mb-4">
            <span className="text-[36px] font-extrabold text-border leading-none tracking-tighter select-none mt-0.5">
              {feature.num}
            </span>
            <div>
              <div
                className={cn(
                  "w-9 h-9 rounded-[10px] flex items-center justify-center mb-2",
                  feature.accent ? "bg-accent/9 text-accent" : "bg-primary/8 text-primary"
                )}
              >
                <feature.icon size={18} strokeWidth={2.2} />
              </div>
              <h2 className="text-[18px] font-bold text-text-primary tracking-[-0.02em] leading-tight">
                {feature.title}
              </h2>
              <p className="text-[13px] text-text-secondary leading-[1.55] mt-1">
                {feature.desc}
              </p>
            </div>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://picsum.photos/seed/feature${feature.num}/800/500`}
            alt=""
            className="w-full rounded-xl object-cover aspect-video"
          />
        </div>
      ))}

      <div className="h-2" />
    </div>
  );
}
