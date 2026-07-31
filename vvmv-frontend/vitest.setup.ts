import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Without vitest `globals: true`, testing-library cannot register its own
// afterEach auto-cleanup, so stale DOM leaks across tests. Clean up manually.
afterEach(() => {
	cleanup();
});
