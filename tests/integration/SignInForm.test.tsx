import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SignInForm } from "@/components/domains/auth/SignInForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
}));

describe("SignInForm", () => {
  it("초기 상태에서 CTA가 비활성이다", () => {
    render(<SignInForm />);
    const submitBtn = screen.getByRole("button", { name: "인증 코드 받기" });
    expect(submitBtn).toBeDisabled();
  });

  it("잘못된 이메일 입력 시 CTA가 비활성 상태를 유지한다", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText("you@email.com"), "invalid");

    const submitBtn = screen.getByRole("button", { name: "인증 코드 받기" });
    expect(submitBtn).toBeDisabled();
  });

  it("유효한 이메일 입력 시 CTA가 활성화된다", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText("you@email.com"), "test@email.com");

    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: "인증 코드 받기" });
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it("유효한 이메일 제출 시 /sign-in/verify로 이동한다", async () => {
    mockPush.mockClear();
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText("you@email.com"), "test@email.com");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "인증 코드 받기" })).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: "인증 코드 받기" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sign-in/verify");
    });
  });
});
