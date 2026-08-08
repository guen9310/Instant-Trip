import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VerifyForm } from "@/components/domains/auth/VerifyForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams("email=test%40example.com"),
}));

const { mockSignInEmailOtp, mockSendVerificationOtp } = vi.hoisted(() => ({
  mockSignInEmailOtp: vi.fn(),
  mockSendVerificationOtp: vi.fn(),
}));
vi.mock("@/client/authClient", () => ({
  authClient: {
    signIn: { emailOtp: mockSignInEmailOtp },
    emailOtp: { sendVerificationOtp: mockSendVerificationOtp },
  },
}));

function getOtpInput() {
  return screen.getByRole("textbox");
}

describe("VerifyForm", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSignInEmailOtp.mockClear();
    mockSendVerificationOtp.mockClear();
  });

  it("이메일이 마스킹 없이 원문으로 표시된다", () => {
    render(<VerifyForm />);
    expect(
      screen.getByText(/test@example\.com 계정으로 로그인하십시오\./),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("**");
  });

  it("6자리 입력 완료 시 자동으로 인증 요청을 보낸다", async () => {
    mockSignInEmailOtp.mockResolvedValue({
      data: { user: { onboardingDone: true } },
      error: null,
    });
    const user = userEvent.setup();
    render(<VerifyForm />);

    await user.type(getOtpInput(), "123456");

    await waitFor(() => {
      expect(mockSignInEmailOtp).toHaveBeenCalledWith({
        email: "test@example.com",
        otp: "123456",
      });
    });
  });

  it("6자리 미만 입력 시에는 자동 제출되지 않는다", async () => {
    const user = userEvent.setup();
    render(<VerifyForm />);

    await user.type(getOtpInput(), "123");

    expect(mockSignInEmailOtp).not.toHaveBeenCalled();
  });

  it("OTP 인증 성공 후 onboardingDone=true면 /로 이동한다", async () => {
    mockSignInEmailOtp.mockResolvedValue({
      data: { user: { onboardingDone: true } },
      error: null,
    });

    const user = userEvent.setup();
    render(<VerifyForm />);

    await user.type(getOtpInput(), "123456");

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("OTP 인증 성공 후 onboardingDone=false면 /onboarding으로 이동한다", async () => {
    mockSignInEmailOtp.mockResolvedValue({
      data: { user: { onboardingDone: false } },
      error: null,
    });

    const user = userEvent.setup();
    render(<VerifyForm />);

    await user.type(getOtpInput(), "123456");

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/onboarding");
    });
  });

  it("잘못된 코드 입력 시 입력이 초기화되고 에러 메시지가 표시된다", async () => {
    mockSignInEmailOtp.mockResolvedValue({
      data: null,
      error: { code: "INVALID_OTP" },
    });

    const user = userEvent.setup();
    render(<VerifyForm />);

    await user.type(getOtpInput(), "000000");

    await waitFor(() => {
      expect(screen.getByText("코드가 올바르지 않아요.")).toBeInTheDocument();
      expect(getOtpInput()).toHaveValue("");
    });
  });

  it("OTP 만료 시 에러 메시지가 표시된다", async () => {
    mockSignInEmailOtp.mockResolvedValue({
      data: null,
      error: { code: "OTP_EXPIRED" },
    });

    const user = userEvent.setup();
    render(<VerifyForm />);

    await user.type(getOtpInput(), "123456");

    await waitFor(() => {
      expect(
        screen.getByText("코드가 만료됐어요. 재발송해 주세요."),
      ).toBeInTheDocument();
    });
  });

  it("시도 횟수 초과 시 에러 메시지가 표시된다", async () => {
    mockSignInEmailOtp.mockResolvedValue({
      data: null,
      error: { code: "TOO_MANY_ATTEMPTS" },
    });

    const user = userEvent.setup();
    render(<VerifyForm />);

    await user.type(getOtpInput(), "123456");

    await waitFor(() => {
      expect(
        screen.getByText("시도 횟수를 초과했어요. 재발송해 주세요."),
      ).toBeInTheDocument();
    });
  });

  it("코드 재전송 버튼 클릭 시 sendVerificationOtp를 호출한다", async () => {
    mockSendVerificationOtp.mockResolvedValue({});

    const user = userEvent.setup();
    render(<VerifyForm />);

    await user.click(screen.getByRole("button", { name: "코드 재전송" }));

    await waitFor(() => {
      expect(mockSendVerificationOtp).toHaveBeenCalledWith({
        email: "test@example.com",
        type: "sign-in",
      });
    });
  });

  it("코드 재전송 실패 시 에러 메시지가 표시되어야 한다", async () => {
    mockSendVerificationOtp.mockResolvedValue({
      error: { message: "발송 실패" },
    });
    const user = userEvent.setup();
    render(<VerifyForm />);

    await user.click(screen.getByRole("button", { name: "코드 재전송" }));

    await waitFor(() => {
      expect(screen.getByText(/재발송에 실패했어요/)).toBeInTheDocument();
    });
  });

  it("에러 후 재입력 시 유효성 검사가 즉시 작동하지 않는다", async () => {
    mockSignInEmailOtp.mockResolvedValue({
      data: null,
      error: { code: "INVALID_OTP" },
    });

    const user = userEvent.setup();
    render(<VerifyForm />);

    await user.type(getOtpInput(), "000000");

    await waitFor(() => {
      expect(screen.getByText("코드가 올바르지 않아요.")).toBeInTheDocument();
    });

    // 재입력 중 (3자리) — 에러가 사라지지 않아야 함 (reValidateMode: onSubmit)
    await user.type(getOtpInput(), "123");

    expect(
      screen.queryByText("6자리 코드를 입력해주세요."),
    ).not.toBeInTheDocument();
  });
});
