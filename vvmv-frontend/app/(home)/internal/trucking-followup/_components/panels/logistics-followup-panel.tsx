"use client";

import { format } from "date-fns";
import { CheckCircle, ExternalLink, FileText, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { UserDisplay } from "@/components/ui/user-display";
import { CompanyBadge } from "../../../followup/_components/shared/company-badge";
import type { FollowUpRow } from "../../../followup/types";

interface LogisticsFollowUpPanelProps {
	followUps: FollowUpRow[];
}

// Format date helper
const formatDate = (dateStr?: string | null) => {
	if (!dateStr) return "-";
	try {
		return format(new Date(dateStr), "dd/MM/yyyy");
	} catch {
		return dateStr;
	}
};

export function LogisticsFollowUpPanel({
	followUps,
}: LogisticsFollowUpPanelProps) {
	if (!followUps || followUps.length === 0) {
		return (
			<div className="p-8 text-center text-muted-foreground italic">
				No related logistics follow up found.
			</div>
		);
	}

	return (
		<div className="p-4">
			<div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
				<Table className="w-full text-xs">
					<TableHeader className="bg-slate-100 dark:bg-slate-800">
						<TableRow>
							<TableHead className="px-2 py-2 w-8 text-center">#</TableHead>
							<TableHead className="px-2 py-2 w-24">Job Number</TableHead>
							<TableHead className="px-2 py-2 w-16">Type</TableHead>
							<TableHead className="px-2 py-2 w-16">Mode</TableHead>
							<TableHead className="px-2 py-2 w-28">MST</TableHead>
							<TableHead className="px-2 py-2 min-w-[150px]">Company</TableHead>
							<TableHead className="px-2 py-2 w-28">Bill/Booking</TableHead>
							<TableHead className="px-2 py-2 w-16 text-right">CBM</TableHead>
							<TableHead className="px-2 py-2 w-16 text-right">G.W</TableHead>
							<TableHead className="px-2 py-2 w-16 text-right">Qty</TableHead>
							<TableHead className="px-2 py-2 min-w-[160px]">Handler</TableHead>
							<TableHead className="px-2 py-2 w-20">ETA/ETD</TableHead>
							<TableHead className="px-2 py-2 w-16 text-center">Done</TableHead>
							<TableHead className="px-2 py-2 w-10 text-center">Link</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
						{followUps.map((fu, index) => (
							<TableRow
								key={fu.id}
								className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
							>
								<TableCell className="px-2 py-2 text-center text-muted-foreground">
									{index + 1}
								</TableCell>
								<TableCell className="px-2 py-2 font-medium">
									{fu.jobNumber || "-"}
								</TableCell>
								<TableCell className="px-2 py-2">
									{fu.operationType ? (
										<Badge
											variant={
												fu.operationType === "XUAT" ? "destructive" : "default"
											}
											className="text-[10px] px-1.5 py-0.5"
										>
											{fu.operationType}
										</Badge>
									) : (
										"-"
									)}
								</TableCell>
								<TableCell className="px-2 py-2">
									<span className="truncate">{fu.serviceMode || "-"}</span>
								</TableCell>
								<TableCell className="px-2 py-2 font-mono text-[10px]">
									{fu.taxCode || "-"}
								</TableCell>
								<TableCell className="px-2 py-2">
									<CompanyBadge
										taxCode={fu.taxCode}
										companyName={fu.companyName || null}
										className="text-[10px] px-1.5 py-0.5"
									/>
								</TableCell>
								<TableCell className="px-2 py-2 text-muted-foreground">
									{fu.billOrBooking || "-"}
								</TableCell>
								<TableCell className="px-2 py-2 text-right tabular-nums">
									{fu.cbm ?? "-"}
								</TableCell>
								<TableCell className="px-2 py-2 text-right tabular-nums">
									{fu.grossWeight ?? "-"}
								</TableCell>
								<TableCell className="px-2 py-2 text-right tabular-nums">
									{fu.quantity ?? "-"}
								</TableCell>
								<TableCell className="px-2 py-2">
									{fu.handlerUser ? (
										<UserDisplay user={fu.handlerUser} size="xs" showEmail />
									) : fu.handler ? (
										<span className="text-muted-foreground text-xs">
											{fu.handler}
										</span>
									) : (
										<span className="text-muted-foreground">-</span>
									)}
								</TableCell>
								<TableCell className="px-2 py-2 tabular-nums text-muted-foreground">
									{formatDate(fu.etaEtd)}
								</TableCell>
								<TableCell className="px-2 py-2 text-center">
									{fu.isFinished ? (
										<CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
									) : (
										<XCircle className="w-4 h-4 text-red-400 mx-auto" />
									)}
								</TableCell>
								<TableCell className="px-2 py-2 text-center">
									{fu.driveUrl ? (
										<a
											href={fu.driveUrl}
											target="_blank"
											rel="noopener noreferrer"
											title="Open Drive folder"
											className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
										>
											<ExternalLink className="w-3.5 h-3.5 text-blue-500" />
										</a>
									) : (
										<span className="text-muted-foreground">-</span>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			{/* Summary footer */}
			<div className="flex items-center justify-between mt-3 px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
				<div className="flex items-center gap-4">
					<span>
						<FileText className="w-3.5 h-3.5 inline mr-1" />
						{followUps.length} jobs
					</span>
					<span>
						Total CBM:{" "}
						{followUps.reduce((acc, fu) => acc + (fu.cbm ?? 0), 0).toFixed(2)}
					</span>
					<span>
						Total G.W:{" "}
						{followUps
							.reduce((acc, fu) => acc + (fu.grossWeight ?? 0), 0)
							.toFixed(2)}{" "}
						kg
					</span>
					<span>
						Total Qty:{" "}
						{followUps.reduce((acc, fu) => acc + (fu.quantity ?? 0), 0)}
					</span>
				</div>
			</div>
		</div>
	);
}
