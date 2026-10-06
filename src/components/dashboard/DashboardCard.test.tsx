/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DashboardCard } from "./DashboardCard";

afterEach(() => cleanup());

describe("DashboardCard", () => {
  it("renders children when not loading and not empty", () => {
    render(
      <DashboardCard title="Test Card">
        <span data-testid="content">Hello</span>
      </DashboardCard>,
    );

    expect(screen.getByText("Test Card")).toBeTruthy();
    expect(screen.getByTestId("content").textContent).toBe("Hello");
  });

  it("shows a skeleton when loading", () => {
    render(
      <DashboardCard title="Loading" loading>
        <span data-testid="content">Should not show</span>
      </DashboardCard>,
    );

    expect(screen.getByText("Loading")).toBeTruthy();
    expect(screen.queryByTestId("content")).toBeNull();
    // Skeleton renders placeholder divs.
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });

  it("shows an empty state when empty", () => {
    render(
      <DashboardCard title="Empty" empty emptyLabel="Nothing here">
        <span data-testid="content">Should not show</span>
      </DashboardCard>,
    );

    expect(screen.getByText("Nothing here")).toBeTruthy();
    expect(screen.queryByTestId("content")).toBeNull();
  });

  it("renders the action slot in the header", () => {
    render(
      <DashboardCard
        title="With Action"
        action={<button data-testid="action-btn">⋯</button>}
      >
        <span>Body</span>
      </DashboardCard>,
    );

    expect(screen.getByTestId("action-btn")).toBeTruthy();
  });
});
