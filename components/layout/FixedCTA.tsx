import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FixedCTA() {
  return (
    <div className="fixed bottom-20 right-6 z-40 md:bottom-10">
      <Link
        href="/onboarding"
        className="flex h-14 items-center gap-2 rounded-full bg-point px-6 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <span className="font-semibold">Get Started</span>
        <ArrowRight className="h-5 w-5" />
      </Link>
    </div>
  );
}

