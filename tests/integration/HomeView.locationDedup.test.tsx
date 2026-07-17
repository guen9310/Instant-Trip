import { waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithClient } from "@/tests/utils";

/* ── mock: 서버 액션 ─────────────────────────────────────────────────── */
const { mockFetchCityAction } = vi.hoisted(() => ({
  mockFetchCityAction: vi.fn(),
}));
vi.mock("@/app/actions/geocode", () => ({
  fetchCityAction: mockFetchCityAction,
}));

const { mockGetHomeDataAction, mockGetHomeDataByRegionAction } = vi.hoisted(() => ({
  mockGetHomeDataAction: vi.fn(),
  mockGetHomeDataByRegionAction: vi.fn(),
}));
vi.mock("@/app/actions/home", () => ({
  getHomeDataAction: mockGetHomeDataAction,
  getHomeDataByRegionAction: mockGetHomeDataByRegionAction,
}));

vi.mock("@/app/actions/course", () => ({
  generateCourseFromPlaceAction: vi.fn(),
}));

vi.mock("@/client/hooks/useWeatherQuery", () => ({
  useWeatherQuery: () => ({ data: null, isPending: false }),
}));

const mockPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const EMPTY_HOME_DATA = {
  region: null,
  places: [],
  ongoingFestivals: [],
  upcomingFestivals: [],
  errors: [],
};

function mockGeolocationSuccess(lat: number, lng: number) {
  Object.defineProperty(global.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback) => {
        success({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition);
      },
    },
  });
}

// zustand persist가 저장하는 실제 포맷: { state: { state: LocationState }, version }
function seedPersistedLocation(state: unknown) {
  localStorage.setItem(
    "location-store",
    JSON.stringify({ state: { state }, version: 0 }),
  );
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  mockFetchCityAction.mockReset();
  mockGetHomeDataAction.mockReset();
  mockGetHomeDataByRegionAction.mockReset();
  mockPush.mockClear();
});

describe("홈 데이터 중복 호출 방지 (restored 위치 게이팅)", () => {
  it("이전 세션의 stale geo 위치가 복원돼도 fetch하지 않고, 재확인 완료 후 새 좌표로 1회만 fetch한다", async () => {
    seedPersistedLocation({
      status: "granted",
      city: "이전위치",
      sidoName: "이전위치도",
      source: "geo",
      lat: 10.1111,
      lng: 20.2222,
    });

    mockGeolocationSuccess(35.58771234, 129.36834567);
    mockFetchCityAction.mockResolvedValue({
      displayName: "새위치",
      sidoName: "새위치도",
    });
    mockGetHomeDataAction.mockResolvedValue(EMPTY_HOME_DATA);

    const { HomeView } = await import("@/components/domains/home/HomeView");
    renderWithClient(<HomeView />);

    await waitFor(() => expect(mockGetHomeDataAction).toHaveBeenCalled());

    // 딱 1번만 호출 — stale 위치로 인한 선행 fetch가 없어야 한다
    expect(mockGetHomeDataAction).toHaveBeenCalledTimes(1);
    // 호출 인자는 새로 지오코딩된 위치여야 한다 (stale 위치가 아님)
    expect(mockGetHomeDataAction).toHaveBeenCalledWith(
      expect.objectContaining({ sidoName: "새위치도", city: "새위치" }),
    );
  });

  it("이전 세션의 manual 위치는 즉시 확정 상태로 취급해 재확인 없이 1회만 fetch한다", async () => {
    seedPersistedLocation({
      status: "granted",
      city: "제주",
      sidoName: "제주",
      source: "manual",
      lat: 33.4996,
      lng: 126.5312,
    });

    mockGetHomeDataByRegionAction.mockResolvedValue(EMPTY_HOME_DATA);

    const { HomeView } = await import("@/components/domains/home/HomeView");
    renderWithClient(<HomeView />);

    await waitFor(() => expect(mockGetHomeDataByRegionAction).toHaveBeenCalled());

    expect(mockGetHomeDataByRegionAction).toHaveBeenCalledTimes(1);
    expect(mockGetHomeDataAction).not.toHaveBeenCalled();
    // 수동 위치는 재확인용 geolocation 호출이 필요 없다
    expect(mockFetchCityAction).not.toHaveBeenCalled();
  });
});
