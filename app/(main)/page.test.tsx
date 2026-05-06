import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LandingPage from "./page";

describe("LandingPage", () => {
  describe("렌더링", () => {
    it("에러 없이 렌더링되어야 한다.", () => {
      expect(() => render(<LandingPage />)).not.toThrow();
    });

    it("컴포넌트가 DOM에 마운트되어야 한다.", () => {
      const { container } = render(<LandingPage />);
      expect(container.firstChild).not.toBeNull();
    });

    it("헤드라인 텍스트가 표시되어야 한다.", () => {
      render(<LandingPage />);
      expect(screen.getByText(/시간이 나는 순간/)).toBeInTheDocument();
    });

    it("'지금 시작하기' CTA가 표시되어야 한다.", () => {
      render(<LandingPage />);
      const ctas = screen.getAllByRole("link", { name: "지금 시작하기" });
      expect(ctas.length).toBeGreaterThan(0);
    });

    it("'코스 둘러보기' 링크가 표시되어야 한다.", () => {
      render(<LandingPage />);
      expect(
        screen.getByRole("link", { name: "코스 둘러보기" }),
      ).toBeInTheDocument();
    });

    it("피처 섹션 3개가 모두 렌더링되어야 한다.", () => {
      render(<LandingPage />);
      expect(screen.getByText("결정은 저희가 할게요")).toBeInTheDocument();
      expect(screen.getByText("지금 갈 수 있는 곳만")).toBeInTheDocument();
      expect(screen.getByText("마음에 안 들면 거절하세요")).toBeInTheDocument();
    });
  });
});
