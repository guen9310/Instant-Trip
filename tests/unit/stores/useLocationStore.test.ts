import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/app/actions/geocode", () => ({
  fetchCityAction: vi.fn().mockResolvedValue({ displayName: "지오시", sidoName: "지오도" }),
}));

const MANUAL = {
  status: "granted",
  city: "서울",
  sidoName: "서울",
  source: "manual",
  lat: 37.5663,
  lng: 126.9779,
} as const;

/** getCurrentPosition을 수동으로 풀 수 있게 콜백을 붙잡아 둔다 */
function deferredGeolocation() {
  const captured: {
    success?: PositionCallback;
    error?: PositionErrorCallback;
  } = {};
  Object.defineProperty(global.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback) => {
        captured.success = success;
        captured.error = error;
      },
    },
  });
  return captured;
}

function mockPermission(state: PermissionState) {
  Object.defineProperty(global.navigator, "permissions", {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state }) },
  });
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/*
 * requestPermission은 Permissions API 조회와 getCurrentPosition(최대 10초)을 기다리는
 * 동안 제어를 놓는다. 그 사이 사용자가 "지역 직접 선택"으로 지역을 고르면, 뒤늦게 도착한
 * 위치 확인 결과가 그 선택을 덮어써 화면이 다시 위치 거부 화면으로 되돌아갔다.
 */
describe("useLocationStore — 수동 선택 지역은 자동 위치 확인 결과보다 우선한다", () => {
  it("권한 조회 대기 중 setCity가 끼어들면 뒤늦은 system-denied가 선택을 덮어쓰지 않는다", async () => {
    mockPermission("denied");
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: vi.fn() },
    });

    const { useLocationStore } = await import("@/client/stores/useLocationStore");
    const pending = useLocationStore.getState().requestPermission();
    useLocationStore.getState().setCity("서울", "서울", 37.5663, 126.9779);
    await pending;

    expect(useLocationStore.getState().state).toEqual(MANUAL);
  });

  it("getCurrentPosition 대기 중 setCity가 끼어들면 뒤늦은 denied가 선택을 덮어쓰지 않는다", async () => {
    mockPermission("prompt");
    const geo = deferredGeolocation();

    const { useLocationStore } = await import("@/client/stores/useLocationStore");
    await useLocationStore.getState().requestPermission();
    expect(useLocationStore.getState().state.status).toBe("requesting");

    useLocationStore.getState().setCity("서울", "서울", 37.5663, 126.9779);
    geo.error?.({ code: 1, TIMEOUT: 3 } as unknown as GeolocationPositionError);

    expect(useLocationStore.getState().state).toEqual(MANUAL);
  });

  it("getCurrentPosition 대기 중 setCity가 끼어들면 뒤늦은 geo 좌표가 선택을 덮어쓰지 않는다", async () => {
    mockPermission("prompt");
    const geo = deferredGeolocation();

    const { useLocationStore } = await import("@/client/stores/useLocationStore");
    await useLocationStore.getState().requestPermission();

    useLocationStore.getState().setCity("서울", "서울", 37.5663, 126.9779);
    geo.success?.({
      coords: { latitude: 35.1, longitude: 129.0 },
    } as GeolocationPosition);
    // fetchCityAction await까지 흘려보낸다
    await new Promise((r) => setTimeout(r, 0));

    expect(useLocationStore.getState().state).toEqual(MANUAL);
  });

  it("이미 수동 선택된 상태에서는 권한 조회 자체를 하지 않는다", async () => {
    mockPermission("denied");
    const getCurrentPosition = vi.fn();
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    const { useLocationStore } = await import("@/client/stores/useLocationStore");
    useLocationStore.getState().setCity("서울", "서울", 37.5663, 126.9779);
    await useLocationStore.getState().requestPermission();

    expect(navigator.permissions.query).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(useLocationStore.getState().state).toEqual(MANUAL);
  });
});
