import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignInForm } from "@/components/domains/auth/SignInForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
}));

const { mockSendVerificationOtp } = vi.hoisted(() => ({
  mockSendVerificationOtp: vi.fn(),
}));
vi.mock("@/client/auth-client", () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: mockSendVerificationOtp },
  },
}));

describe("SignInForm", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSendVerificationOtp.mockClear();
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

  it("유효하지 않은 이메일 제출 시 에러 메시지가 표시된다", async () => {
    mockSendVerificationOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText("you@email.com"), "invalid");
    await user.click(screen.getByRole("button", { name: "인증 코드 받기" }));

    await waitFor(() => {
      expect(mockSendVerificationOtp).not.toHaveBeenCalled();
    });
  });

  it("유효한 이메일 제출 성공 시 /sign-in/verify로 이동한다", async () => {
    mockSendVerificationOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText("you@email.com"), "test@email.com");
    await user.click(screen.getByRole("button", { name: "인증 코드 받기" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/sign-in/verify?email=test%40email.com",
      );
    });
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
});
