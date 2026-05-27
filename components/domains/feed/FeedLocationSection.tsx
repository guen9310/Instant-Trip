"use client";

import dynamic from "next/dynamic";

const FeedLocationCard = dynamic(
  () => import("./FeedLocationCard").then((m) => m.FeedLocationCard),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl bg-card border border-border px-5 py-4 mb-5 animate-pulse">
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-3.25 h-3.25 rounded bg-muted shrink-0" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="h-5.75 w-52 rounded bg-muted" />
            <div className="h-3 w-36 rounded bg-muted mt-1" />
            <div className="h-3 w-20 rounded bg-muted mt-0.5" />
          </div>
          <div className="h-8.5 w-20 rounded-xl bg-muted shrink-0" />
        </div>
      </div>
    ),
  }
);

export function FeedLocationSection() {
  return <FeedLocationCard />;
}
