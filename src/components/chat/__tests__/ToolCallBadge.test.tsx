import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge, getToolLabel } from "../ToolCallBadge";

afterEach(() => {
  cleanup();
});

// Group A: pure unit tests for getToolLabel

test("getToolLabel: str_replace_editor create", () => {
  expect(
    getToolLabel("str_replace_editor", { command: "create", path: "Card.tsx" })
  ).toBe("Creating Card.tsx");
});

test("getToolLabel: str_replace_editor str_replace", () => {
  expect(
    getToolLabel("str_replace_editor", {
      command: "str_replace",
      path: "Button.tsx",
    })
  ).toBe("Editing Button.tsx");
});

test("getToolLabel: str_replace_editor insert uses same label as str_replace", () => {
  expect(
    getToolLabel("str_replace_editor", {
      command: "insert",
      path: "Button.tsx",
    })
  ).toBe("Editing Button.tsx");
});

test("getToolLabel: str_replace_editor view", () => {
  expect(
    getToolLabel("str_replace_editor", { command: "view", path: "index.tsx" })
  ).toBe("Reading index.tsx");
});

test("getToolLabel: str_replace_editor undo_edit", () => {
  expect(
    getToolLabel("str_replace_editor", {
      command: "undo_edit",
      path: "App.tsx",
    })
  ).toBe("Undoing changes to App.tsx");
});

test("getToolLabel: file_manager rename", () => {
  expect(
    getToolLabel("file_manager", { command: "rename", path: "OldName.tsx" })
  ).toBe("Renaming OldName.tsx");
});

test("getToolLabel: file_manager delete", () => {
  expect(
    getToolLabel("file_manager", { command: "delete", path: "OldName.tsx" })
  ).toBe("Deleting OldName.tsx");
});

test("getToolLabel: extracts basename from nested path", () => {
  expect(
    getToolLabel("str_replace_editor", {
      command: "create",
      path: "src/components/Card.tsx",
    })
  ).toBe("Creating Card.tsx");
});

test("getToolLabel: missing path returns Processing…", () => {
  expect(getToolLabel("str_replace_editor", {})).toBe("Processing…");
});

test("getToolLabel: unknown tool with valid path falls back to Working on", () => {
  expect(
    getToolLabel("unknown_tool", { command: "create", path: "Foo.tsx" })
  ).toBe("Working on Foo.tsx");
});

test("getToolLabel: unknown command for known tool falls back to Working on", () => {
  expect(
    getToolLabel("str_replace_editor", {
      command: "unknown_cmd",
      path: "Foo.tsx",
    })
  ).toBe("Working on Foo.tsx");
});

// Group B: render tests for ToolCallBadge

test("ToolCallBadge renders the label text", () => {
  render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "Card.tsx" },
        state: "call",
      }}
    />
  );
  expect(screen.getByText("Creating Card.tsx")).toBeDefined();
});

test("ToolCallBadge shows spinner when pending (state=call)", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "Card.tsx" },
        state: "call",
      }}
    />
  );
  expect(container.querySelector(".animate-spin")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("ToolCallBadge shows green dot when done (state=result with result)", () => {
  const { container } = render(
    <ToolCallBadge
      toolInvocation={{
        toolCallId: "1",
        toolName: "str_replace_editor",
        args: { command: "create", path: "Card.tsx" },
        state: "result",
        result: "Success",
      }}
    />
  );
  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeNull();
});
