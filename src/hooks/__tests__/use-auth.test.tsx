import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import * as actions from "@/actions";
import * as getProjectsAction from "@/actions/get-projects";
import * as createProjectAction from "@/actions/create-project";
import * as anonTracker from "@/lib/anon-work-tracker";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

const mockProject = { id: "proj-1", name: "Test Project" };

beforeEach(() => {
  vi.clearAllMocks();
  (anonTracker.getAnonWorkData as any).mockReturnValue(null);
  (getProjectsAction.getProjects as any).mockResolvedValue([]);
  (createProjectAction.createProject as any).mockResolvedValue(mockProject);
});

describe("useAuth — initial state", () => {
  test("isLoading starts false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("useAuth — signIn", () => {
  test("sets isLoading true while in flight, false after", async () => {
    let resolveSignIn!: (v: any) => void;
    (actions.signIn as any).mockReturnValue(
      new Promise((r) => { resolveSignIn = r; })
    );
    (getProjectsAction.getProjects as any).mockResolvedValue([mockProject]);

    const { result } = renderHook(() => useAuth());

    let signInPromise: Promise<any>;
    act(() => { signInPromise = result.current.signIn("a@b.com", "password"); });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignIn({ success: true });
      await signInPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("calls signIn action with email and password", async () => {
    (actions.signIn as any).mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "secret123");
    });

    expect(actions.signIn).toHaveBeenCalledWith("user@example.com", "secret123");
  });

  test("returns the action result on success", async () => {
    (actions.signIn as any).mockResolvedValue({ success: true });
    (getProjectsAction.getProjects as any).mockResolvedValue([mockProject]);

    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "pw");
    });

    expect(returnValue).toEqual({ success: true });
  });

  test("returns the action result on failure without navigating", async () => {
    (actions.signIn as any).mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "wrong");
    });

    expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("isLoading resets to false even when action throws", async () => {
    (actions.signIn as any).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pw").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("useAuth — signUp", () => {
  test("calls signUp action with email and password", async () => {
    (actions.signUp as any).mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "password1");
    });

    expect(actions.signUp).toHaveBeenCalledWith("new@example.com", "password1");
  });

  test("returns the action result on failure without navigating", async () => {
    (actions.signUp as any).mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("existing@example.com", "pw");
    });

    expect(returnValue).toEqual({ success: false, error: "Email already registered" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("isLoading resets to false even when action throws", async () => {
    (actions.signUp as any).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("a@b.com", "pw").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("useAuth — post sign-in navigation (shared by signIn and signUp)", () => {
  test("transfers anon work to a new project and navigates to it", async () => {
    (actions.signIn as any).mockResolvedValue({ success: true });
    (anonTracker.getAnonWorkData as any).mockReturnValue({
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/App.jsx": {} },
    });
    (createProjectAction.createProject as any).mockResolvedValue({ id: "anon-proj" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pw");
    });

    expect(createProjectAction.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.any(Array),
        data: expect.any(Object),
      })
    );
    expect(anonTracker.clearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/anon-proj");
  });

  test("skips anon transfer when messages array is empty", async () => {
    (actions.signIn as any).mockResolvedValue({ success: true });
    (anonTracker.getAnonWorkData as any).mockReturnValue({
      messages: [],
      fileSystemData: {},
    });
    (getProjectsAction.getProjects as any).mockResolvedValue([mockProject]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pw");
    });

    expect(createProjectAction.createProject).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(`/${mockProject.id}`);
  });

  test("navigates to most recent existing project when no anon work", async () => {
    (actions.signIn as any).mockResolvedValue({ success: true });
    (getProjectsAction.getProjects as any).mockResolvedValue([
      { id: "recent-proj" },
      { id: "older-proj" },
    ]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pw");
    });

    expect(mockPush).toHaveBeenCalledWith("/recent-proj");
    expect(createProjectAction.createProject).not.toHaveBeenCalled();
  });

  test("creates a new project when user has no existing projects", async () => {
    (actions.signIn as any).mockResolvedValue({ success: true });
    (getProjectsAction.getProjects as any).mockResolvedValue([]);
    (createProjectAction.createProject as any).mockResolvedValue({ id: "new-proj" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pw");
    });

    expect(createProjectAction.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/new-proj");
  });

  test("signUp also triggers post-sign-in navigation on success", async () => {
    (actions.signUp as any).mockResolvedValue({ success: true });
    (getProjectsAction.getProjects as any).mockResolvedValue([{ id: "proj-2" }]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("new@example.com", "password1");
    });

    expect(mockPush).toHaveBeenCalledWith("/proj-2");
  });
});
