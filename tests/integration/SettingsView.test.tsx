import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettingsView } from "@/components/domains/settings/SettingsView";
import { DEFAULT_PREFS } from "@/shared/constants/preferences";
import { renderWithClient } from "@/tests/utils";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const { mockUpdateUser } = vi.hoisted(() => ({ mockUpdateUser: vi.fn() }));
vi.mock("@/client/auth-client", () => ({
  authClient: { updateUser: mockUpdateUser, signOut: vi.fn() },
}));

const { mockRedirectToSignIn } = vi.hoisted(() => ({
  mockRedirectToSignIn: vi.fn(),
}));
vi.mock("@/client/redirectToSignIn", () => ({
  redirectToSignIn: mockRedirectToSignIn,
}));

describe("SettingsView — 세션 만료 처리", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUpdateUser.mockClear();
    mockRedirectToSignIn.mockClear();
  });

  it("저장 중 세션이 만료(401)되면 사유를 실어 로그인 화면으로 리다이렉트한다", async () => {
    mockUpdateUser.mockResolvedValue({ error: { status: 401 } });
    const user = userEvent.setup();
    renderWithClient(<SettingsView initialPrefs={DEFAULT_PREFS} />);

    await user.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() => {
      expect(mockRedirectToSignIn).toHaveBeenCalledWith("session_expired");
    });
    // 소프트 네비게이션(router.push)으로는 리다이렉트하지 않는다 — 하드 리다이렉트만 써야
    // 뒤로가기 시 이 화면이 클라이언트 캐시로 재노출되는 문제가 재발하지 않는다.
    expect(mockPush).not.toHaveBeenCalled();
    // 안내 문구는 이 화면이 아니라 로그인 화면에서 보여준다 — 리다이렉트 직전에 잠깐
    // 띄우는 방식은 사용자가 볼 틈이 없어 여기서는 아무 것도 렌더하지 않아야 한다.
    expect(
      screen.queryByText("세션이 만료됐어요. 다시 로그인해 주세요."),
    ).not.toBeInTheDocument();
  });

  it("일반 저장 실패(401 아님)에서는 리다이렉트하지 않고 인라인 에러만 보여준다", async () => {
    mockUpdateUser.mockResolvedValue({ error: { status: 500 } });
    const user = userEvent.setup();
    renderWithClient(<SettingsView initialPrefs={DEFAULT_PREFS} />);

    await user.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() => {
      expect(screen.getByText("저장에 실패했어요. 다시 시도해 주세요.")).toBeInTheDocument();
    });
    expect(mockRedirectToSignIn).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("정상 저장 시 프로필 화면으로 이동한다", async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderWithClient(<SettingsView initialPrefs={DEFAULT_PREFS} />);

    await user.click(screen.getByRole("button", { name: "저장하기" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/profile");
    });
    expect(mockRedirectToSignIn).not.toHaveBeenCalled();
  });
});
