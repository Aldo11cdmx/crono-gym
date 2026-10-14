/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VolumeSparkline } from "./VolumeSparkline";

describe("VolumeSparkline", () => {
  it("names itself as a trend for assistive technology", () => {
    render(<VolumeSparkline points={[{ volumeKg: 100 }, { volumeKg: 200 }]} />);

    expect(
      screen.getByLabelText("Tendencia de volumen de los últimos 7 días"),
    ).toBeTruthy();
  });

  it("draws a polyline through every point", () => {
    const { container } = render(
      <VolumeSparkline
        points={[{ volumeKg: 100 }, { volumeKg: 200 }, { volumeKg: 50 }]}
      />,
    );

    const polyline = container.querySelector("polyline");
    expect(polyline).toBeTruthy();
    // Three points produce three coordinates on the line.
    expect(polyline?.getAttribute("points")?.split(" ").length).toBe(3);
  });

  it("draws a flat line for a week with no volume", () => {
    const { container } = render(
      <VolumeSparkline points={[{ volumeKg: 0 }, { volumeKg: 0 }]} />,
    );

    expect(container.querySelector("polyline")).toBeTruthy();
  });

  it("renders an empty line rather than crashing without points", () => {
    const { container } = render(<VolumeSparkline points={[]} />);

    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("polyline")).toBeTruthy();
  });
});
