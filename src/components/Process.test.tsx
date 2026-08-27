import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Process } from "./Process";
import { processStages } from "../lib/data";

describe("Process", () => {
  it("lists every stage as a heading", () => {
    render(<Process />);
    for (const s of processStages) {
      expect(screen.getByRole("button", { name: new RegExp(s.title) })).toBeInTheDocument();
    }
  });

  it("opens the first stage so the page never looks empty", () => {
    render(<Process />);
    const first = screen.getByRole("button", { name: new RegExp(processStages[0].title) });
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(processStages[0].detail)).toBeInTheDocument();
  });

  it("keeps the rest collapsed, showing their summary instead", () => {
    render(<Process />);
    const second = screen.getByRole("button", { name: new RegExp(processStages[1].title) });
    expect(second).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(processStages[1].detail)).not.toBeInTheDocument();
    expect(within(second).getByText(processStages[1].summary)).toBeInTheDocument();
  });

  it("expands a stage on click and collapses the previous one", async () => {
    const user = userEvent.setup();
    render(<Process />);
    const second = screen.getByRole("button", { name: new RegExp(processStages[1].title) });

    await user.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(processStages[1].detail)).toBeInTheDocument();
    expect(screen.queryByText(processStages[0].detail)).not.toBeInTheDocument();
  });

  it("collapses a stage when its own header is clicked again", async () => {
    const user = userEvent.setup();
    render(<Process />);
    const first = screen.getByRole("button", { name: new RegExp(processStages[0].title) });

    await user.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(processStages[0].detail)).not.toBeInTheDocument();
  });

  it("links an open stage to its artifact on GitHub", async () => {
    const user = userEvent.setup();
    render(<Process />);
    // Skip stage 01 — it renders open, so clicking it would collapse it.
    const staged = processStages.slice(1).find((s) => s.artifact)!;

    await user.click(screen.getByRole("button", { name: new RegExp(staged.title) }));
    const link = screen.getByRole("link", { name: staged.artifact!.label });
    expect(link).toHaveAttribute("href", expect.stringContaining(staged.artifact!.path));
    expect(link).toHaveAttribute("target", "_blank");
  });
});
