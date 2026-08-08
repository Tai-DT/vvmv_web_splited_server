import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
	test: {
		environment: "happy-dom",
		exclude: ["node_modules", ".next", "dist"],
		globalSetup: ["./vitest.global-setup.ts"],
		setupFiles: ["./vitest.setup.ts"],
	},
});
