import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StartView } from "@/components/domains/start/StartView";
import { renderWithClient } from "@/tests/utils";
import type { LocationState } from "@/shared/types/location";
import type { Prefs } from "@/shared/constants/preferences";

// 렌더 스냅샷과 effect 모두 같은 상태를 보도록 getState도 같은 객체를 돌려준다
// (HomeView.test.tsx와 같은 방식).
const { mockStore, mockGenerate } = vi.hoisted(() => ({
  mockStore: {
    state: { status: "idle" } as LocationState,
    requestPermission: vi.fn(),
  },
  mockGenerate: vi.fn(),
}));
vi.mock("@/client/stores/useLocationStore", () => {
  const useLocationStore = () => mockStore;
  useLocationStore.getState = () => mockStore;
  return { useLocationStore };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/actions/course", () => ({ generateCourseAction: mockGenerate }));
vi.mock("@/client/redirectToSignIn", () => ({ redirectToSignIn: vi.fn() }));

const PREFS = {} as Prefs;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StartView — 복원된 위치 재확인", () => {
  it("새로고침 전에 저장된(restored) GPS 위치는 다시 확인하고, 확인 전엔 추천을 막는다", () => {
    mockStore.state = {
      status: "granted",
      city: "서울 중구",
      source: "restored",
      lat: 37.56,
      lng: 126.97,
    };
    renderWithClient(<StartView prefs={PREFS} />);

    expect(mockStore.requestPermission).toHaveBeenCalledTimes(1);
    expect(screen.getByText("위치 확인 중...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /어디 갈지 뽑기/ })).toBeDisabled();
  });

  it("직접 고른 지역(manual)은 다시 확인하지 않는다", () => {
    mockStore.state = { status: "granted", city: "부산 해운대구", source: "manual", lat: 35.16, lng: 129.16 };
    renderWithClient(<StartView prefs={PREFS} />);

    expect(mockStore.requestPermission).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /어디 갈지 뽑기/ })).toBeEnabled();
  });
});

describe("StartView — 추천 실패 안내", () => {
  beforeEach(() => {
    mockStore.state = { status: "granted", city: "서울 중구", source: "geo", lat: 37.56, lng: 126.97 };
  });

  it("알 수 없는 실패(UNKNOWN)면 재시도 안내를 보여준다", async () => {
    mockGenerate.mockResolvedValue({ ok: false, code: "UNKNOWN", error: "x" });
    renderWithClient(<StartView prefs={PREFS} />);

    await userEvent.setup().click(screen.getByRole("button", { name: /어디 갈지 뽑기/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("다시 시도해주세요"));
    expect(screen.getByRole("button", { name: /어디 갈지 뽑기/ })).toBeEnabled();
  });

  it("예외(네트워크 등)도 재시도 안내를 보여준다", async () => {
    mockGenerate.mockRejectedValue(new Error("network"));
    renderWithClient(<StartView prefs={PREFS} />);

    await userEvent.setup().click(screen.getByRole("button", { name: /어디 갈지 뽑기/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
