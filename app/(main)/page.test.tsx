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

    it("'hello' 텍스트가 화면에 표시되어야 한다.", () => {
      render(<LandingPage />);
      expect(screen.getByText("hello")).toBeInTheDocument();
    });

    it("텍스트가 div 요소 안에 렌더링되어야 한다.", () => {
      render(<LandingPage />);
      const element = screen.getByText("hello");
      expect(element.tagName).toBe("DIV");
    });
  });

});
