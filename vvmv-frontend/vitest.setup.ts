import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// `test.globals` is off, so React Testing Library cannot register its own
// auto-cleanup hook. Unmount between tests, otherwise a second render in the
// same file leaves the first one mounted and queries hit duplicate elements.
afterEach(() => {
	cleanup();
});
