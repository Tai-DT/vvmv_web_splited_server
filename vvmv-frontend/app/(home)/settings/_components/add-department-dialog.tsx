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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/lib/auth-client";
import type { Site } from "@/prisma/client";

type AddDepartmentDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

export function AddDepartmentDialog({
	open,
	onOpenChange,
	onSuccess,
}: AddDepartmentDialogProps) {
	const [formData, setFormData] = useState({
		name: "",
		description: "",
		site: "" as Site | "",
	});
	const [loading, setLoading] = useState(false);
	const { data: session } = useSession();

	const isManager = session?.user?.role === "MANAGER";

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.name || !formData.site) {
			toast.error("Please fill in required fields");
			return;
		}

		try {
			setLoading(true);
			const res = await fetch("/api/admin/departments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: formData.name,
					description: formData.description || null,
					site: formData.site,
				}),
			});

			if (res.ok) {
				toast.success("Department created successfully");
				setFormData({ name: "", description: "", site: "" });
				onOpenChange(false);
				onSuccess();
			} else {
				const data = await res.json();
				toast.error(data.message || "Failed to create department");
			}
		} catch (error) {
			console.error("Failed to create department:", error);
			toast.error("Failed to create department");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add Department</DialogTitle>
					<DialogDescription>
						Create a new department for a specific site
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
							placeholder="e.g., Trucking, Logistics"
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
						<label className="text-sm font-medium">Site *</label>
						{isManager ? (
							<div className="p-2 border rounded bg-gray-50">
								{(session.user as any)?.site || "N/A"}
							</div>
						) : (
							<Select
								value={formData.site}
								onValueChange={(value) =>
									setFormData({ ...formData, site: value as Site })
								}
								disabled={loading}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select site" />
								</SelectTrigger>{" "}
								<SelectPositioner>
									<SelectContent>
										<SelectItem value="SGN">Ho Chi Minh (SGN)</SelectItem>
										<SelectItem value="HAN">Ha Noi (HAN)</SelectItem>
										<SelectItem value="DAD">Da Nang (DAD)</SelectItem>
									</SelectContent>
								</SelectPositioner>
							</Select>
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
							{loading ? "Creating..." : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
