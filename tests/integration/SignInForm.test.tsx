import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignInForm } from "@/components/domains/auth/SignInForm";

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

const { mockSendVerificationOtp } = vi.hoisted(() => ({
  mockSendVerificationOtp: vi.fn(),
}));
vi.mock("@/client/authClient", () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: mockSendVerificationOtp },
  },
}));

describe("SignInForm", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSendVerificationOtp.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  it("초기 상태에서 CTA가 비활성이다", () => {
    render(<SignInForm />);
    expect(screen.getByRole("button", { name: "인증 코드 받기" })).toBeDisabled();
  });

  it("이메일 입력 시 CTA가 활성화된다", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText("you@email.com"), "test@email.com");

    expect(screen.getByRole("button", { name: "인증 코드 받기" })).not.toBeDisabled();
  });

  it("유효하지 않은 이메일에서는 CTA가 비활성 상태라 발송되지 않는다", async () => {
    mockSendVerificationOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText("you@email.com"), "invalid");

    expect(screen.getByRole("button", { name: "인증 코드 받기" })).toBeDisabled();
    expect(mockSendVerificationOtp).not.toHaveBeenCalled();
  });

  it("유효한 이메일 제출 성공 시 같은 화면에서 인증 코드 입력 UI로 전환된다", async () => {
    mockSendVerificationOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText("you@email.com"), "test@email.com");
    await user.click(screen.getByRole("button", { name: "인증 코드 받기" }));

    await waitFor(() => {
      expect(mockSendVerificationOtp).toHaveBeenCalledWith({
        email: "test@email.com",
        type: "sign-in",
      });
      expect(screen.getByLabelText("6자리 인증 코드")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("API 오류 시 에러 메시지가 표시된다", async () => {
    mockSendVerificationOtp.mockResolvedValue({ error: { message: "fail" } });
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText("you@email.com"), "test@email.com");
    await user.click(screen.getByRole("button", { name: "인증 코드 받기" }));

    await waitFor(() => {
      expect(
        screen.getByText("코드 발송에 실패했어요. 다시 시도해 주세요."),
      ).toBeInTheDocument();
    });
  });

  it("reason=session_expired 파라미터가 있으면 세션 만료 안내 배너를 보여준다", () => {
    mockSearchParams = new URLSearchParams("reason=session_expired");
    render(<SignInForm />);

    expect(
      screen.getByText("세션이 만료됐어요. 다시 로그인해 주세요."),
    ).toBeInTheDocument();
  });

  it("reason 파라미터가 없으면 세션 만료 안내 배너를 보여주지 않는다", () => {
    render(<SignInForm />);

    expect(
      screen.queryByText("세션이 만료됐어요. 다시 로그인해 주세요."),
    ).not.toBeInTheDocument();
  });
});
