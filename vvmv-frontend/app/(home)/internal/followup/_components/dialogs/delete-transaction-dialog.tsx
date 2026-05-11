"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { FollowUpRow } from "../../types";

interface DeleteTransationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	followUp: FollowUpRow | null;
	onDeleteRecord: (record: FollowUpRow) => Promise<void>;
}

export function DeleteTransationDialog({
	open,
	onOpenChange,
	followUp,
	onDeleteRecord,
}: DeleteTransationDialogProps) {
	const [isLoading, _setIsLoading] = useState(false);

	const handleSubmit = async () => {
		if (!followUp?.id) {
			toast.error("No follow-up record deleted");
			return;
		}
		await onDeleteRecord(followUp);
	};
	const handleClose = () => {
		onOpenChange(false);
	};
	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{`Are you sure to delete job ${followUp?.jobNumber}`}
					</DialogTitle>
				</DialogHeader>

				<DialogFooter className="pt-4">
					<Button variant="outline" onClick={handleClose} disabled={isLoading}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={isLoading}
						className="gap-1 bg-red-500  hover:bg-red-300"
					>
						{isLoading ? "Deleting..." : `Delete`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
