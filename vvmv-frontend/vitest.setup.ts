import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-registers cleanup when Vitest runs with `globals: true`.
// This project keeps globals off, so unmount between tests explicitly — otherwise
// rendered DOM accumulates and queries fail with "Found multiple elements".
afterEach(() => {
	cleanup();
});
