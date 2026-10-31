import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Projects } from "./Projects";
import { getContent } from "../lib/content";

describe("Projects browsing", () => {
  it("opens with a text-only contents list linking every case study", () => {
    render(<Projects />);
    const contents = screen.getByRole("navigation", { name: "Project contents" });
    expect(contents.querySelector("img")).toBeNull();
    expect(within(contents).queryByRole("button")).toBeNull();
    for (const project of getContent().projects) {
      expect(within(contents).getByRole("link", { name: `Explore ${project.title}` })).toHaveAttribute("href", `#proj-${project.id}`);
      expect(document.getElementById(`proj-${project.id}`)).toBeInTheDocument();
    }
  });
  it("mounts SHM controls only after an explicit request", async () => {
    const user = userEvent.setup();
    render(<Projects />);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    const launch = screen.getByRole("button", { name: "Try the alert logic" });
    await user.click(launch);
    expect(screen.getByRole("dialog", { name: "SHM alert simulation" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close preview" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(launch).toHaveFocus();
  });
});
