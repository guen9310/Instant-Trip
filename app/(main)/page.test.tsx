import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "./page";

describe("Home Component", () => {
  it("홈 페이지가 랜덜이 되어야 한다.", () => {
    render(<Home />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
