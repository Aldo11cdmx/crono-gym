/**
 * @vitest-environment jsdom
 *
 * HubTabs is the tab strip at the top of the exercise hub. It owns no state of
 * its own — `selected` and `onSelect` are passed in — so the tests focus on the
 * parts that can break without coordination with a parent:
 *
 *  - Exactly one tab is selected, and only it is in the tab order.
 *  - Click and keyboard both call `onSelect`.
 *  - Arrow keys wrap and move focus.
 *  - ARIA attributes are wired so a screen reader lands on the right tab.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { HUB_TAB_IDS, HubTabs, isHubTabId } from "./HubTabs";
import { HUB_LABELS } from "@/lib/i18n";

describe("isHubTabId", () => {
  it("accepts the three tab ids", () => {
    expect(isHubTabId("demo")).toBe(true);
    expect(isHubTabId("progress")).toBe(true);
    expect(isHubTabId("records")).toBe(true);
  });

  it("rejects unknown ids", () => {
    expect(isHubTabId("progreso")).toBe(false);
    expect(isHubTabId("")).toBe(false);
    expect(isHubTabId(null)).toBe(false);
    expect(isHubTabId(undefined)).toBe(false);
    expect(isHubTabId("dEmo")).toBe(false);
  });
});

describe("HubTabs", () => {
  afterEach(() => cleanup());

  it("renders exactly three tabs in document order", () => {
    const { getAllByRole } = render(
      <HubTabs selected="demo" onSelect={() => {}} />,
    );
    const tabs = getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs.map((t) => t.textContent)).toEqual(
      HUB_TAB_IDS.map((id) => HUB_LABELS.tabs[id].label),
    );
  });

  it("marks only the selected tab as selected", () => {
    const { getAllByRole } = render(
      <HubTabs selected="progress" onSelect={() => {}} />,
    );
    const tabs = getAllByRole("tab");
    tabs.forEach((tab, i) => {
      expect(tab.getAttribute("aria-selected")).toBe(i === 1 ? "true" : "false");
    });
  });

  it("keeps only the selected tab in the tab order", () => {
    const { getAllByRole } = render(
      <HubTabs selected="progress" onSelect={() => {}} />,
    );
    const tabs = getAllByRole("tab");
    tabs.forEach((tab, i) => {
      expect(tab.tabIndex).toBe(i === 1 ? 0 : -1);
    });
  });

  it("calls onSelect with the tab id on click", () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <HubTabs selected="demo" onSelect={onSelect} />,
    );
    const recordsTab = getByRole("tab", { name: HUB_LABELS.tabs.records.aria });
    fireEvent.click(recordsTab);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("records");
  });

  it("has a tablist role with an accessible label", () => {
    const { getByRole } = render(
      <HubTabs selected="demo" onSelect={() => {}} />,
    );
    const tablist = getByRole("tablist");
    expect(tablist.getAttribute("aria-label")).toBe(HUB_LABELS.tabsAriaLabel);
  });

  it("wires aria-controls and aria-labelledby through id", () => {
    const { getAllByRole } = render(
      <HubTabs selected="demo" onSelect={() => {}} />,
    );
    const tabs = getAllByRole("tab");
    tabs.forEach((tab, i) => {
      const id = HUB_TAB_IDS[i];
      expect(tab.getAttribute("aria-controls")).toBe(`hub-panel-${id}`);
      expect(tab.getAttribute("id")).toBe(`hub-tab-${id}`);
    });
  });

  it("ArrowRight selects the next tab", () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <HubTabs selected="demo" onSelect={onSelect} />,
    );
    fireEvent.keyDown(getByRole("tablist"), { key: "ArrowRight" });
    expect(onSelect).toHaveBeenCalledWith("progress");
  });

  it("ArrowLeft selects the previous tab", () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <HubTabs selected="progress" onSelect={onSelect} />,
    );
    fireEvent.keyDown(getByRole("tablist"), { key: "ArrowLeft" });
    expect(onSelect).toHaveBeenCalledWith("demo");
  });

  it("ArrowRight wraps from the last tab to the first", () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <HubTabs selected="records" onSelect={onSelect} />,
    );
    fireEvent.keyDown(getByRole("tablist"), { key: "ArrowRight" });
    expect(onSelect).toHaveBeenCalledWith("demo");
  });

  it("ArrowLeft wraps from the first tab to the last", () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <HubTabs selected="demo" onSelect={onSelect} />,
    );
    fireEvent.keyDown(getByRole("tablist"), { key: "ArrowLeft" });
    expect(onSelect).toHaveBeenCalledWith("records");
  });

  it("ignores other keys", () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <HubTabs selected="demo" onSelect={onSelect} />,
    );
    fireEvent.keyDown(getByRole("tablist"), { key: "Enter" });
    fireEvent.keyDown(getByRole("tablist"), { key: " " });
    fireEvent.keyDown(getByRole("tablist"), { key: "Escape" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("moves focus to the newly selected tab on arrow key", () => {
    const onSelect = vi.fn();
    const { getByRole, getAllByRole } = render(
      <HubTabs selected="demo" onSelect={onSelect} />,
    );
    fireEvent.keyDown(getByRole("tablist"), { key: "ArrowRight" });
    const targetTab = getAllByRole("tab")[1];
    expect(document.activeElement).toBe(targetTab);
  });

  it("clicking the selected tab still fires onSelect", () => {
    const onSelect = vi.fn();
    const { getByRole } = render(
      <HubTabs selected="demo" onSelect={onSelect} />,
    );
    const demoTab = getByRole("tab", { name: HUB_LABELS.tabs.demo.aria });
    fireEvent.click(demoTab);
    expect(onSelect).toHaveBeenCalledWith("demo");
  });
});
