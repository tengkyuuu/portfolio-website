import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ActivityEditor } from "./ActivityEditor";
import { DEFAULT_CONTENT, getContent, saveContent } from "../../lib/content";

it("saves activity and meme without changing other CMS sections", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ configured: false }))));
  saveContent(structuredClone(DEFAULT_CONTENT));
  const before = getContent();
  render(<ActivityEditor />);
  fireEvent.click(screen.getByRole("button", { name: "Sleeping" }));
  fireEvent.change(screen.getByLabelText("A little context"), { target: { value: "Back in the morning" } });
  fireEvent.click(screen.getByRole("button", { name: /Business mode/ }));
  expect(getContent().activity).toMatchObject({ status: "Sleeping", note: "Back in the morning", meme: "corporate" });
  expect(Date.parse(getContent().activity.updatedAt)).not.toBeNaN();
  expect(getContent().hero).toEqual(before.hero);
  expect(getContent().posts).toEqual(before.posts);
  expect(getContent().designs).toEqual(before.designs);
  expect(await screen.findByText("Not connected yet")).toBeInTheDocument();
});
