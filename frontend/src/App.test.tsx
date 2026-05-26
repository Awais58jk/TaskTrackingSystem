import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

function unauthenticatedFetch(input: RequestInfo | URL) {
  const url = String(input);
  if (url.endsWith("/api/auth/me")) {
    return Promise.resolve(
      new Response(JSON.stringify({ detail: "Authentication credentials were not provided." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
  if (url.endsWith("/api/auth/csrf")) {
    return Promise.resolve(
      new Response(JSON.stringify({ csrfToken: "test-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
  return Promise.resolve(
    new Response(JSON.stringify({ detail: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("TaskFlow app shell", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(unauthenticatedFetch));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  it("renders the landing page for visitors", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(await screen.findByRole("heading", { name: /control project work/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
  });

  it("renders the registration form with accessible labels", async () => {
    window.history.pushState({}, "", "/register");
    render(<App />);

    expect(await screen.findByRole("heading", { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
});
