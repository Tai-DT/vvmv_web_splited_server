"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export interface FieldOption {
	id: string;
	fieldName: string;
	code: string | null;
	name: string;
	color: string | null;
	conditions?: FieldOptionConditions | null;
	order: number;
	site: string | null;
	isActive: boolean;
}

export type FieldOptionConditionPrimitive = string | number | boolean;

export type FieldOptionOperatorObject = {
	$eq?: FieldOptionConditionPrimitive;
	$not?: FieldOptionConditionPrimitive;
	$in?: FieldOptionConditionPrimitive[];
	$nin?: FieldOptionConditionPrimitive[];
	$like?: string; // contains (case-insensitive)
	$startsWith?: string; // starts with (case-insensitive)
	$endsWith?: string; // ends with (case-insensitive)
};

export type FieldOptionConditionValue =
	| FieldOptionConditionPrimitive
	| FieldOptionConditionPrimitive[]
	| FieldOptionOperatorObject;

export type FieldOptionConditions = Record<
	string,
	FieldOptionConditionValue
> & {
	$or?: FieldOptionConditions[]; // any branch
	$and?: FieldOptionConditions[]; // all branches
};

// Display value: "CODE - Name" if code exists, else just "Name"
export function formatFieldOption(
	opt: Pick<FieldOption, "code" | "name">,
): string {
	return opt.code ? `${opt.code} - ${opt.name}` : opt.name;
}

// Stored value: code if exists, else name
export function getFieldOptionValue(
	opt: Pick<FieldOption, "code" | "name">,
): string {
	return opt.code ?? opt.name;
}

// Find a FieldOption matching a stored value
export function findFieldOption(
	options: FieldOption[],
	storedValue: string | null | undefined,
): FieldOption | undefined {
	if (!storedValue) return undefined;
	return options.find((o) => (o.code ?? o.name) === storedValue);
}

// ─── READ hook (for FLUP forms) ─────────────────────────────────────────────

async function fetchFieldOptions(
	fieldName: string,
	site?: string,
	context?: FieldOptionConditions,
): Promise<FieldOption[]> {
	const params = new URLSearchParams({ fieldName });
	if (site) params.append("site", site);
	if (context && Object.keys(context).length > 0) {
		params.append("context", JSON.stringify(context));
	}

	const res = await apiFetch(`/api/field-options?${params}`);
	if (!res.ok) throw new Error("Failed to fetch field options");
	const data = await res.json();
	return data.items as FieldOption[];
}

export function useFieldOptions(
	fieldName: string,
	site?: string,
	context?: FieldOptionConditions,
) {
	const {
		data = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["field-options", fieldName, site, context],
		queryFn: () => fetchFieldOptions(fieldName, site, context),
		staleTime: 5 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
		enabled: !!fieldName,
	});

	return {
		options: data,
		isLoading,
		error: error instanceof Error ? error.message : null,
	};
}

// ─── ADMIN hooks (for Settings page) ────────────────────────────────────────

export interface FieldOptionWithUser extends FieldOption {
	user?: { name: string | null; email: string };
	createdAt?: string;
	updatedAt?: string;
}

async function fetchAdminFieldOptions(
	fieldName?: string,
	site?: string | null,
): Promise<{ items: FieldOptionWithUser[]; fieldNames: string[] }> {
	const params = new URLSearchParams();
	if (fieldName) params.append("fieldName", fieldName);
	if (site !== undefined && site !== null) params.append("site", site);
	params.append("pageSize", "0");

	const res = await apiFetch(`/api/admin/field-options?${params}`);
	if (!res.ok) throw new Error("Failed to fetch admin field options");
	return res.json();
}

export function useAdminFieldOptions(fieldName?: string, site?: string | null) {
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ["admin-field-options", fieldName, site],
		queryFn: () => fetchAdminFieldOptions(fieldName, site),
		staleTime: 0,
	});

	return {
		items: data?.items ?? [],
		fieldNames: data?.fieldNames ?? [],
		isLoading,
		error: error instanceof Error ? error.message : null,
		refetch,
	};
}

export interface CreateFieldOptionPayload {
	fieldName: string;
	code?: string;
	name: string;
	color?: string;
	conditions?: FieldOptionConditions | null;
	order?: number;
	site?: string | null;
	isActive?: boolean;
}

export interface BulkCreateFieldOptionsResult {
	items: FieldOptionWithUser[];
	count: number;
}

export function useCreateFieldOption() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: CreateFieldOptionPayload) => {
			const res = await apiFetch("/api/admin/field-options", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to create");
			return data.item as FieldOptionWithUser;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-field-options"] });
			queryClient.invalidateQueries({ queryKey: ["field-options"] });
		},
	});
}

export function useCreateFieldOptionsBulk() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: CreateFieldOptionPayload[]) => {
			const res = await apiFetch("/api/admin/field-options", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to create in bulk");
			return data as BulkCreateFieldOptionsResult;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-field-options"] });
			queryClient.invalidateQueries({ queryKey: ["field-options"] });
		},
	});
}

export interface UpdateFieldOptionPayload
	extends Partial<CreateFieldOptionPayload> {
	id: string;
}

export function useUpdateFieldOption() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ id, ...payload }: UpdateFieldOptionPayload) => {
			const res = await apiFetch(`/api/admin/field-options/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to update");
			return data.item as FieldOptionWithUser;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-field-options"] });
			queryClient.invalidateQueries({ queryKey: ["field-options"] });
		},
	});
}

export function useDeleteFieldOption() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			const res = await apiFetch(`/api/admin/field-options/${id}`, {
				method: "DELETE",
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to delete");
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin-field-options"] });
			queryClient.invalidateQueries({ queryKey: ["field-options"] });
		},
	});
}
