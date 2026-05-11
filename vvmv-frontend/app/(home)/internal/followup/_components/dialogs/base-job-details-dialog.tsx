"use client";

import { ExternalLink, Eye, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Re-export DialogFooter for convenience
export { DialogFooter };

export interface TabConfig {
	value: string;
	label: string;
	labelShort?: string; // For mobile display
	icon: React.ComponentType<{ className?: string }>;
	content: ReactNode;
	badge?: number; // Count for badge display
}

interface BaseJobDetailsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	jobNumber?: string | null;
	companyName?: string | null;
	driveUrl?: string | null;
	isRefreshing?: boolean;
	tabs: TabConfig[];
	defaultTab?: string;
	footer?: ReactNode; // Optional footer content
}

export function BaseJobDetailsDialog({
	open,
	onOpenChange,
	jobNumber,
	companyName,
	driveUrl,
	isRefreshing = false,
	tabs,
	defaultTab,
	footer,
}: BaseJobDetailsDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="!max-w-[95vw] sm:!max-w-[90vw] lg:!max-w-[85vw] !w-[95vw] sm:!w-[90vw] lg:!w-[85vw] !h-[95vh] sm:!h-[90vh] lg:!h-[90vh] !max-h-[95vh] sm:!max-h-[90vh] lg:!max-h-[90vh] !p-0 overflow-hidden flex flex-col gap-0 !border-none bg-slate-50 dark:bg-slate-950 !rounded-lg sm:!rounded-xl shadow-2xl">
				<DialogHeader className="px-4 sm:px-6 lg:px-10 py-4 sm:py-5 lg:py-6 bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 text-white shrink-0 relative overflow-hidden border-b border-indigo-500/30">
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between relative z-10 gap-3 sm:gap-4">
						<div className="flex items-center gap-3 sm:gap-5 flex-1 min-w-0">
							<div className="size-10 sm:size-12 lg:size-14 rounded-lg sm:rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner flex-shrink-0">
								<Eye className="size-5 sm:size-6 lg:size-7 text-white drop-shadow-sm" />
							</div>
							<div className="min-w-0">
								<DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight">
									Job Detail Inspector
								</DialogTitle>
								<div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-1 sm:mt-1.5">
									<Badge
										variant="outline"
										className="bg-white/10 text-white border-white/20 px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-mono whitespace-nowrap flex-shrink-0"
									>
										{jobNumber || "NO JOB #"}
									</Badge>
									{companyName && (
										<span className="text-xs sm:text-sm lg:text-base text-white/70 truncate max-w-full sm:max-w-[400px] lg:max-w-[600px] font-medium">
											{companyName}
										</span>
									)}
								</div>
							</div>
						</div>

						<div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
							{isRefreshing && (
								<div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 animate-pulse">
									<Loader2 className="size-3.5 text-white animate-spin" />
									<span className="text-[10px] font-bold uppercase tracking-wider text-white">
										Processing...
									</span>
								</div>
							)}
							{driveUrl && (
								<Button
									size="sm"
									className="h-8 sm:h-9 bg-white hover:bg-white/90 text-indigo-600 gap-1 sm:gap-2 px-2 sm:px-4 rounded-full font-semibold text-xs sm:text-sm shadow-sm transition-all active:scale-95 flex-shrink-0"
									render={
										<a
											href={driveUrl}
											target="_blank"
											rel="noopener noreferrer"
										/>
									}
								>
									<ExternalLink className="size-3 sm:size-3.5" />
									<span className="hidden sm:inline">View Folder</span>
								</Button>
							)}
						</div>
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-hidden flex flex-col">
					<Tabs
						defaultValue={defaultTab || tabs[0]?.value}
						className="h-full flex flex-col"
					>
						<div className="border-b bg-white dark:bg-slate-900 px-4 sm:px-6 lg:px-10 shrink-0 shadow-sm z-10">
							<TabsList className="w-full bg-transparent gap-2 sm:gap-4 lg:gap-6 p-0">
								{tabs.map((tab) => (
									<TabsTrigger
										key={tab.value}
										value={tab.value}
										className="flex-1 rounded-none border-b-3 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-1 sm:px-2 pb-0.5 font-bold text-xs sm:text-sm h-12 sm:h-14 gap-1.5 sm:gap-2.5 transition-all uppercase tracking-wide whitespace-nowrap justify-center"
									>
										<tab.icon className="size-4 sm:size-5" />
										<span className="hidden sm:inline">{tab.label}</span>
										{tab.labelShort && (
											<span className="sm:hidden">{tab.labelShort}</span>
										)}
										{(tab.badge ?? 0) > 0 && (
											<span className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300">
												{tab.badge}
											</span>
										)}
									</TabsTrigger>
								))}
							</TabsList>
						</div>

						<div className="flex-1 overflow-auto bg-white dark:bg-slate-950/50">
							<div className="p-4 sm:p-6 lg:p-10 max-w-[2000px] mx-auto">
								{tabs.map((tab) => (
									<TabsContent
										key={tab.value}
										value={tab.value}
										className="mt-0"
									>
										{tab.content}
									</TabsContent>
								))}
							</div>
						</div>
					</Tabs>
				</div>

				{footer}
			</DialogContent>
		</Dialog>
	);
}
