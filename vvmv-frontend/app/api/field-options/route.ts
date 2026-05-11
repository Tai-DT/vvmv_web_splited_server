import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";
import type { Site } from "@/prisma/client";

type FieldOptionConditionPrimitive = string | number | boolean;

// Operator syntax: { "$eq": "val" } | { "$in": [..] } | { "$like": "str" }
// | { "$startsWith": "str" } | { "$endsWith": "str" } | { "$not": "val" }
type FieldOptionOperatorObject = {
	$eq?: FieldOptionConditionPrimitive;
	$not?: FieldOptionConditionPrimitive;
	$in?: FieldOptionConditionPrimitive[];
	$nin?: FieldOptionConditionPrimitive[];
	$like?: string;
	$startsWith?: string;
	$endsWith?: string;
};

type FieldOptionConditionValue =
	| FieldOptionConditionPrimitive
	| FieldOptionConditionPrimitive[]
	| FieldOptionOperatorObject;

// Top-level: { field: value, ... }  →  AND
// Top-level: { $or: [ {field:v}, ... ] }  →  OR across sub-conditions
// Top-level: { $and: [ {field:v}, ... ] }  →  AND across sub-conditions
type FieldOptionConditions = {
	$or?: FieldOptionConditions[];
	$and?: FieldOptionConditions[];
	[field: string]:
		| FieldOptionConditionValue
		| FieldOptionConditions[]
		| undefined;
};

function matchesSingleValue(
	actualValue: unknown,
	expectedValue: FieldOptionConditionValue,
): boolean {
	if (actualValue === undefined || actualValue === null) return false;

	// Operator object e.g. { $like: "FC", $not: "AAA" }
	if (
		typeof expectedValue === "object" &&
		!Array.isArray(expectedValue) &&
		expectedValue !== null
	) {
		const op = expectedValue as FieldOptionOperatorObject;
		const actual = String(actualValue).toLowerCase();

		if (op.$eq !== undefined && String(op.$eq).toLowerCase() !== actual)
			return false;
		if (op.$not !== undefined && String(op.$not).toLowerCase() === actual)
			return false;
		if (
			op.$in !== undefined &&
			!op.$in.some((v) => String(v).toLowerCase() === actual)
		)
			return false;
		if (op.$nin?.some((v) => String(v).toLowerCase() === actual)) return false;
		if (op.$like !== undefined && !actual.includes(op.$like.toLowerCase()))
			return false;
		if (
			op.$startsWith !== undefined &&
			!actual.startsWith(op.$startsWith.toLowerCase())
		)
			return false;
		if (
			op.$endsWith !== undefined &&
			!actual.endsWith(op.$endsWith.toLowerCase())
		)
			return false;

		return true;
	}

	// Array shorthand  e.g. ["AIR", "LCL"]  →  OR / $in
	if (Array.isArray(expectedValue)) {
		const expectedStrs = expectedValue.map((v) => String(v).toLowerCase());
		if (Array.isArray(actualValue)) {
			return (actualValue as unknown[]).some((v) =>
				expectedStrs.includes(String(v).toLowerCase()),
			);
		}
		return expectedStrs.includes(String(actualValue).toLowerCase());
	}

	// Primitive  →  equality
	if (Array.isArray(actualValue)) {
		return (actualValue as unknown[]).some(
			(v) => String(v).toLowerCase() === String(expectedValue).toLowerCase(),
		);
	}
	return (
		String(actualValue).toLowerCase() === String(expectedValue).toLowerCase()
	);
}

function matchesConditions(
	optionConditions: unknown,
	context: Record<string, unknown>,
): boolean {
	if (!optionConditions || typeof optionConditions !== "object") return true;

	const cond = optionConditions as FieldOptionConditions;

	// Top-level $or — any single branch must pass
	if (Array.isArray(cond.$or)) {
		if (!cond.$or.some((branch) => matchesConditions(branch, context)))
			return false;
	}

	// Top-level $and — all branches must pass
	if (Array.isArray(cond.$and)) {
		if (!cond.$and.every((branch) => matchesConditions(branch, context)))
			return false;
	}

	// Field-level conditions (skip meta keys $or/$and)
	const fieldEntries = Object.entries(cond).filter(
		([k]) => k !== "$or" && k !== "$and",
	);

	if (fieldEntries.length === 0 && !cond.$or && !cond.$and) return true;

	return fieldEntries.every(([field, expectedValue]) =>
		matchesSingleValue(
			context[field],
			expectedValue as FieldOptionConditionValue,
		),
	);
}

// GET /api/field-options?fieldName=invoiceType&site=SGN
// Returns active options for a given fieldName, scoped by site (includes global options)
export async function GET(request: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(request, "field-options");
	if (delegated) return delegated;

	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const fieldName = searchParams.get("fieldName");
		const siteParam = searchParams.get("site") as Site | null;
		const contextParam = searchParams.get("context");

		if (!fieldName) {
			return NextResponse.json(
				{ message: "fieldName is required" },
				{ status: 400 },
			);
		}

		const userSite = (session.user as any).site as Site | undefined;
		const effectiveSite = siteParam || userSite || "SGN";
		const context = contextParam ? JSON.parse(contextParam) : {};

		const rawItems = await prismaRPA.fieldOption.findMany({
			where: {
				fieldName,
				isActive: true,
				OR: [
					{ site: null }, // global options
					{ site: effectiveSite }, // site-specific options
				],
			},
			orderBy: [{ order: "asc" }, { code: "asc" }, { name: "asc" }],
			select: {
				id: true,
				code: true,
				name: true,
				color: true,
				conditions: true,
				order: true,
				site: true,
			},
		});

		const items = rawItems.filter((item) =>
			matchesConditions(item.conditions, context),
		);

		return NextResponse.json({ items });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
