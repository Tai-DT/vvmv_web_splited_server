#!/usr/bin/env node
// Warns when a Nest-registered path also has app/api/**/route.ts (intentional Next fallback when BACKEND_URL is unset — exit 0).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const appApi = path.join(root, "app", "api");
const registryFile = path.join(root, "lib", "backend-registry.ts");

function walkRouteFiles(dir, acc = []) {
	if (!fs.existsSync(dir)) return acc;
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, ent.name);
		if (ent.isDirectory()) walkRouteFiles(p, acc);
		else if (ent.isFile() && ent.name === "route.ts") acc.push(p);
	}
	return acc;
}

function fileToApiPath(file) {
	const dir = path.dirname(file);
	const rel = path.relative(appApi, dir);
	if (rel === "") return "/api";
	const segs = rel.split(path.sep).map((s) => {
		if (s.startsWith("[[...") && s.endsWith("]]"))
			return `:${s.slice(4, -2)}*`; // optional catch-all (unlikely)
		if (s.startsWith("[...") && s.endsWith("]")) return `:${s.slice(4, -1)}*`;
		if (s.startsWith("[") && s.endsWith("]")) return `:${s.slice(1, -1)}`;
		return s;
	});
	return "/api/" + segs.join("/");
}

const regText = fs.readFileSync(registryFile, "utf8");
const sources = new Set(
	[...regText.matchAll(/\bsource:\s*"(\/api[^"]*)"/g)].map((m) => m[1]),
);

const routeFiles = walkRouteFiles(appApi);
/** @type {string[]} */
const overlaps = [];
for (const f of routeFiles) {
	const apiPath = fileToApiPath(f);
	if (sources.has(apiPath)) overlaps.push(apiPath);
}

overlaps.sort();
const unique = [...new Set(overlaps)];
for (const p of unique) {
	console.warn(
		`[check:api-routing] ${p}: Nest registry + local route.ts — intentional fallback when standalone API is unavailable.`,
	);
}

if (unique.length === 0) {
	console.log("[check:api-routing] No registry/local overlaps detected.");
}
