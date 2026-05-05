"use client";

import { ToolInvocation } from "ai";
import { Loader2 } from "lucide-react";

export function getToolLabel(
  toolName: string,
  args: Record<string, unknown>
): string {
  const path = typeof args?.path === "string" ? args.path : "";
  const command = typeof args?.command === "string" ? args.command : "";
  const filename = path ? (path.split("/").pop() ?? path) : "";

  if (!filename) return "Processing…";

  if (toolName === "str_replace_editor") {
    const labels: Record<string, string> = {
      create: `Creating ${filename}`,
      str_replace: `Editing ${filename}`,
      insert: `Editing ${filename}`,
      view: `Reading ${filename}`,
      undo_edit: `Undoing changes to ${filename}`,
    };
    return labels[command] ?? `Working on ${filename}`;
  }

  if (toolName === "file_manager") {
    const labels: Record<string, string> = {
      rename: `Renaming ${filename}`,
      delete: `Deleting ${filename}`,
    };
    return labels[command] ?? `Working on ${filename}`;
  }

  return `Working on ${filename}`;
}

interface ToolCallBadgeProps {
  toolInvocation: ToolInvocation;
}

export function ToolCallBadge({ toolInvocation }: ToolCallBadgeProps) {
  const label = getToolLabel(
    toolInvocation.toolName,
    toolInvocation.args as Record<string, unknown>
  );
  const isDone =
    toolInvocation.state === "result" &&
    (toolInvocation as { result?: unknown }).result != null;

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
