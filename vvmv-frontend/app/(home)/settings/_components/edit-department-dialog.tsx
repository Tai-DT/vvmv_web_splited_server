"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Site } from "@/prisma/client";

type Department = {
	id: string;
	name: string;
	description: string | null;
	site: Site;
	createdAt: Date;
	updatedAt: Date;
	_count: {
		teams: number;
	};
};

type EditDepartmentDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	department: Department;
	onSuccess: () => void;
};

export function EditDepartmentDialog({
	open,
	onOpenChange,
	department,
	onSuccess,
}: EditDepartmentDialogProps) {
	const [formData, setFormData] = useState({
		name: department.name,
		description: department.description || "",
	});
	const [loading, setLoading] = useState(false);

	const getSiteName = (site: Site) => {
		const siteNames: Record<Site, string> = {
			SGN: "Ho Chi Minh",
			DAD: "Da Nang",
			HAN: "Ha Noi",
		};
		return siteNames[site];
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.name) {
			toast.error("Department name is required");
			return;
		}

		try {
			setLoading(true);
			const res = await fetch("/api/admin/departments", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: department.id,
					name: formData.name,
					description: formData.description || null,
				}),
			});

			if (res.ok) {
				toast.success("Department updated successfully");
				onOpenChange(false);
				onSuccess();
			} else {
				const data = await res.json();
				toast.error(data.message || "Failed to update department");
			}
		} catch (error) {
			console.error("Failed to update department:", error);
			toast.error("Failed to update department");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit Department</DialogTitle>
					<DialogDescription>
						Update department name and description (site cannot be changed)
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="text-sm font-medium">Department Name *</label>
						<Input
							value={formData.name}
							onChange={(e) =>
								setFormData({ ...formData, name: e.target.value })
							}
							disabled={loading}
						/>
					</div>

					<div>
						<label className="text-sm font-medium">Description</label>
						<Input
							value={formData.description}
							onChange={(e) =>
								setFormData({ ...formData, description: e.target.value })
							}
							placeholder="Optional description"
							disabled={loading}
						/>
					</div>

					<div>
						<label className="text-sm font-medium">Site</label>
						<div className="p-2 border rounded bg-gray-50">
							{getSiteName(department.site)} ({department.site})
						</div>
						{department._count.teams > 0 && (
							<p className="text-xs text-amber-600 mt-2">
								⚠️ This department has {department._count.teams} team
								{department._count.teams !== 1 ? "s" : ""}. Cannot change site.
							</p>
						)}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={loading}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={loading}>
							{loading ? "Saving..." : "Save Changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
