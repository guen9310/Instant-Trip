import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OnboardingForm } from "@/components/domains/onboarding/OnboardingForm";
import { usePrefsStore } from "@/client/stores/usePrefsStore";
import { DEFAULT_PREFS } from "@/shared/constants/preferences";

const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const { mockUpdateUser } = vi.hoisted(() => ({ mockUpdateUser: vi.fn() }));
vi.mock("@/client/auth-client", () => ({
  authClient: { updateUser: mockUpdateUser },
}));

async function completeAllSteps(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("네"));
  await waitFor(() =>
    expect(screen.getByText("혼자 여행하시나요?")).toBeInTheDocument(),
  );
  await user.click(screen.getByText("혼자요"));
  await waitFor(() =>
    expect(screen.getByText("어떤 분위기 좋아하세요?")).toBeInTheDocument(),
  );
  await user.click(screen.getByText("조용한 곳"));
  await waitFor(() =>
    expect(screen.getByText("맛집이 중요하신가요?")).toBeInTheDocument(),
  );
  await user.click(screen.getByText("중요해요"));
  await waitFor(() =>
    expect(screen.getByText(/실내가 편한가요/)).toBeInTheDocument(),
  );
  await user.click(screen.getByText("실내가 좋아요"));
}

describe("OnboardingForm", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockUpdateUser.mockClear();
    mockUpdateUser.mockResolvedValue({ data: {}, error: null });
    usePrefsStore.setState({ prefs: DEFAULT_PREFS });
  });

  it("첫 번째 질문과 진행률이 표시된다", () => {
    render(<OnboardingForm />);
    expect(screen.getByText("걷는 거 좋아하세요?")).toBeInTheDocument();
    expect(screen.getByText("1 / 5")).toBeInTheDocument();
  });

  it("옵션 선택 시 다음 스텝으로 진행한다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<OnboardingForm />);

    await user.click(screen.getByText("네"));

    await waitFor(() => {
      expect(screen.getByText("혼자 여행하시나요?")).toBeInTheDocument();
      expect(screen.getByText("2 / 5")).toBeInTheDocument();
    });
    vi.useRealTimers();
  });

  it("건너뛰기 클릭 시 /feed로 이동한다", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm />);

    await user.click(screen.getByText("건너뛰기"));
    expect(mockPush).toHaveBeenCalledWith("/feed");
  });

  it("5단계 완료 시 prefs 저장 후 /onboarding/done으로 이동한다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<OnboardingForm />);

    await completeAllSteps(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/onboarding/done");
    });

    const { prefs } = usePrefsStore.getState();
    expect(prefs.travel).toBe("walk");
    expect(prefs.party).toBe("solo");
    expect(prefs.vibe).toBe("quiet");
    expect(prefs.food).toBe("matjip");
    expect(prefs.indoor).toBe("indoor");

    vi.useRealTimers();
  });

  it("5단계 완료 시 onboardingDone: true로 updateUser를 호출한다", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<OnboardingForm />);

    await completeAllSteps(user);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({ onboardingDone: true }),
      );
    });

    vi.useRealTimers();
  });

  it("updateUser 실패 시 /onboarding/done으로 이동하지 않아야 한다", async () => {
    mockUpdateUser.mockResolvedValue({
      data: null,
      error: { message: "서버 오류" },
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<OnboardingForm />);

    await completeAllSteps(user);

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalledWith("/onboarding/done");

    vi.useRealTimers();
  });
});
