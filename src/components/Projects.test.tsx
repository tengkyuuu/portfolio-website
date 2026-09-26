import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Projects } from "./Projects";
import * as content from "../lib/content";

vi.mock("./InteractiveFigure", () => ({
  InteractiveFigure: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Projects browsing", () => {
  it("filters the visual index without breaking deep links to other case studies", async () => {
    const user = userEvent.setup();
    const site = content.getContent();
    const projects = [
      site.projects.find((project) => project.kind === "web")!,
      site.projects.find((project) => project.kind !== "web")!,
    ];
    vi.spyOn(content, "getContent").mockReturnValue({ ...site, projects });
    render(<Projects />);
    const filters = screen.getByLabelText("Filter projects");
    await user.click(within(filters).getByRole("button", { name: /^Web/ }));
    const cards = screen.getAllByRole("link", { name: /^Explore / });
    expect(cards).toHaveLength(
      projects.filter((project) => project.kind === "web").length,
    );
    for (const project of projects) {
      expect(document.getElementById(`proj-${project.id}`)).toBeInTheDocument();
    }
    await user.click(
      within(filters).getByRole("button", { name: /^All work/ }),
    );
    expect(screen.getAllByRole("link", { name: /^Explore / })).toHaveLength(
      projects.length,
    );
  });
});
