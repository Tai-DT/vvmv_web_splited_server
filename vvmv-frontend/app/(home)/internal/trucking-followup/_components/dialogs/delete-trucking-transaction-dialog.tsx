"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { TruckingFollowUpRow } from "../../types";

interface DeleteTruckingTransactionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	followUp: TruckingFollowUpRow | null;
	onDeleteRecord: (record: TruckingFollowUpRow) => Promise<void>;
}

export function DeleteTruckingTransactionDialog({
	open,
	onOpenChange,
	followUp,
	onDeleteRecord,
}: DeleteTruckingTransactionDialogProps) {
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async () => {
		if (!followUp?.id) {
			return;
		}
		setIsLoading(true);
		try {
			await onDeleteRecord(followUp);
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		if (!isLoading) {
			onOpenChange(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{`Are you sure to delete job ${followUp?.jobNumber}?`}
					</DialogTitle>
				</DialogHeader>

				<DialogFooter className="pt-4">
					<Button variant="outline" onClick={handleClose} disabled={isLoading}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={isLoading}
						className="gap-1 bg-red-500 hover:bg-red-300"
					>
						{isLoading ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
