import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ShmSimulator } from "./ShmSimulator";

describe("SHM example", () => {
  it("changes the alert when an illustrative reading crosses its limit and resets", async () => {
    render(<ShmSimulator />);
    expect(screen.getByText("Within example limits")).toBeInTheDocument();
    expect(screen.getByText(/No live sensor data/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: "Deflection" }), { target: { value: "8" } });
    expect(screen.getByText("Attention needed")).toBeInTheDocument();
    expect(screen.getByText("Deflection is above the example limit.")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Reset simulated readings" }));
    expect(screen.getByText("Within example limits")).toBeInTheDocument();
  });
});
