import { it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/*
 * 회귀 테스트 — 수동 선택 지역이 새로고침 후 system-denied로 덮어써지던 버그.
 *
 * zustand persist는 localStorage를 동기로 읽어 모듈 평가 시점에 이미 복원을 끝내지만,
 * api.getInitialState()는 복원 이전 값({status:"idle"})으로 고정해둔다. zustand의
 * useStore는 이 값을 useSyncExternalStore의 getServerSnapshot으로 넘기고, React는
 * 그 스냅샷을 SSR뿐 아니라 클라이언트 하이드레이션 렌더에도 쓴다 — 그래서 마운트
 * effect의 클로저는 복원된 위치 대신 "idle"을 본다. 이 경로는 RTL의 render()
 * (클라이언트 전용 렌더)로는 재현되지 않으므로 반드시 hydrateRoot로 검증해야 한다.
 */

vi.mock("@/app/actions/geocode", () => ({ fetchCityAction: vi.fn() }));
vi.mock("@/app/actions/home", () => ({
  getHomeDataAction: vi.fn().mockResolvedValue(null),
  getHomeDataByRegionAction: vi.fn().mockResolvedValue({
    region: null,
    places: [],
    ongoingFestivals: [],
    upcomingFestivals: [],
    errors: [],
  }),
}));
vi.mock("@/app/actions/course", () => ({ generateCourseFromPlaceAction: vi.fn() }));
vi.mock("@/client/hooks/useWeatherQuery", () => ({
  useWeatherQuery: () => ({ data: null, isPending: false }),
}));
vi.mock("@/client/hooks/useWeatherForecastAlertQuery", () => ({
  useWeatherForecastAlertQuery: () => ({ data: null }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const MANUAL_JEJU = {
  status: "granted",
  city: "제주",
  sidoName: "제주",
  source: "manual",
  lat: 33.4996,
  lng: 126.5312,
} as const;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  // 브라우저 위치 권한이 거부된 상태 — requestPermission이 불리면 system-denied가 된다
  Object.defineProperty(global.navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn() },
  });
  Object.defineProperty(global.navigator, "permissions", {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state: "denied" }) },
  });
});

it("SSR 하이드레이션 경로에서도 복원된 수동 선택 지역이 유지된다", async () => {
  localStorage.setItem(
    "location-store",
    JSON.stringify({ state: { state: MANUAL_JEJU }, version: 0 }),
  );

  const { useLocationStore } = await import("@/client/stores/useLocationStore");
  const { HomeView } = await import("@/components/domains/home/HomeView");

  // 하이드레이션 렌더가 보게 되는 스냅샷은 복원 이전 값이다 — 이 어긋남이 버그의 전제
  expect(useLocationStore.getInitialState().state).toEqual({ status: "idle" });
  expect(useLocationStore.getState().state).toEqual(MANUAL_JEJU);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <QueryClientProvider client={queryClient}>
      <HomeView />
    </QueryClientProvider>
  );

  const container = document.createElement("div");
  container.innerHTML = renderToString(tree);
  document.body.appendChild(container);

  await act(async () => {
    // 하이드레이션 렌더는 서버 스냅샷("idle")을, 스토어는 복원값을 갖고 있어
    // recoverable error(스냅샷 불일치)가 발생하는 게 정상이다
    hydrateRoot(container, tree, { onRecoverableError: () => {} });
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(useLocationStore.getState().state).toEqual(MANUAL_JEJU);
  expect(navigator.permissions.query).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem("location-store")!).state.state).toEqual(
    MANUAL_JEJU,
  );
});
