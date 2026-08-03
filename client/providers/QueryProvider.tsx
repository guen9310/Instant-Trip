"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useRouter } from "next/navigation";
import { useState } from "react";

function isUnauthorizedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { status?: number }).status === 401
  );
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [queryClient] = useState(() => {
    // 주의: 현재 이 코드베이스에는 useMutation 사용처가 없어 이 onError는
    // 어떤 요청도 가로채지 못한다(2026-07 기준). authClient.* 호출을
    // useMutation으로 감싸게 될 때를 대비한 선반영. 지금 실제 세션 무효
    // 처리는 SettingsView.tsx와 CourseResultView.tsx에서 각각 개별 처리 중.
    const holder: { client?: QueryClient } = {};
    const handleAuthError = (error: unknown) => {
      if (isUnauthorizedError(error)) {
        holder.client?.clear();
        router.push("/sign-in");
      }
    };

    const client = new QueryClient({
      queryCache: new QueryCache({ onError: handleAuthError }),
      mutationCache: new MutationCache({ onError: handleAuthError }),
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // 1 minute
          refetchOnWindowFocus: false,
          retry: 3,
          retryDelay: 1000, // 1 second
        },
      },
    });
    holder.client = client;
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
