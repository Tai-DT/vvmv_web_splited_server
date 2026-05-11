import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export interface FieldTemplate {
	id: string;
	userId: string;
	name: string;
	description: string | null;
	selectedFields: string[];
	fieldData: Record<string, any> | null; // Actual field values, including containers and duplicateCount
	isDefault: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export function useFieldTemplates() {
	return useQuery({
		queryKey: ["field-templates"],
		queryFn: async () => {
			const response = await apiFetch("/api/user/field-templates");
			if (!response.ok) throw new Error("Failed to fetch templates");
			return response.json() as Promise<FieldTemplate[]>;
		},
	});
}

export function useCreateTemplate() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: {
			name: string;
			selectedFields: string[];
			fieldData?: Record<string, any>;
			description?: string;
		}) => {
			const response = await apiFetch("/api/user/field-templates", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to create template");
			}
			return response.json() as Promise<FieldTemplate>;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["field-templates"] });
		},
	});
}

export function useUpdateTemplate() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: {
			id: string;
			name?: string;
			selectedFields?: string[];
			fieldData?: Record<string, any>;
			description?: string;
		}) => {
			const { id, ...updateData } = data;
			const response = await apiFetch(`/api/user/field-templates/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(updateData),
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to update template");
			}
			return response.json() as Promise<FieldTemplate>;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["field-templates"] });
		},
	});
}

export function useDeleteTemplate() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const response = await apiFetch(`/api/user/field-templates/${id}`, {
				method: "DELETE",
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to delete template");
			}
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["field-templates"] });
		},
	});
}
