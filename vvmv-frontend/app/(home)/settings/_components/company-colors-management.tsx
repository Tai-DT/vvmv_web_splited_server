"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Building2,
	Palette,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Spinner } from "@/components/ui/spinner";
import { usePartners } from "@/hooks/use-partners";
import { useSession } from "@/lib/auth-client";
import { PartnerCombobox } from "../../internal/followup/_components/shared/partner-combobox";

const BADGE_VARIANTS = [
	"default",
	"secondary",
	"destructive",
	"success",
	"warning",
	"info",
	"purple",
	"orange",
	"cyan",
	"indigo",
	"emerald",
	"lime",
	"teal",
	"sky",
	"violet",
	"fuchsia",
	"rose",
	"pink",
] as const;

const VARIANT_COLOR_HEX: Record<string, string> = {
	default: "#6b7280",
	secondary: "#6b7280",
	destructive: "#ef4444",
	success: "#22c55e",
	warning: "#f59e0b",
	info: "#3b82f6",
	purple: "#a855f7",
	orange: "#f97316",
	cyan: "#06b6d4",
	indigo: "#6366f1",
	emerald: "#10b981",
	lime: "#84cc16",
	teal: "#14b8a6",
	sky: "#0ea5e9",
	violet: "#8b5cf6",
	fuchsia: "#d946ef",
	rose: "#f43f5e",
	pink: "#ec4899",
};

export function CompanyColorsManagement() {
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const isAdmin = session?.user?.role === "ADMIN";
	const { partners, isLoading: isLoadingPartners } = usePartners();
	const [selectedPartnerId, setSelectedPartnerId] = useState("");
	const [selectedPartnerDomain, setSelectedPartnerDomain] = useState<
		string | undefined
	>(undefined);
	const [listFilter, setListFilter] = useState("");
	const [deleteConfirm, setDeleteConfirm] = useState<{
		open: boolean;
		taxCode: string;
		displayName: string;
	}>({ open: false, taxCode: "", displayName: "" });

	const {
		data: apiData,
		isLoading: isLoadingColors,
		error: loadError,
	} = useQuery({
		queryKey: ["company-colors"],
		queryFn: async () => {
			const res = await fetch("/api/admin/company-colors");
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.details || err.error || "Failed to fetch colors");
			}
			return res.json();
		},
	});

	const mutation = useMutation({
		mutationFn: async ({
			taxCode,
			color,
			domain,
		}: {
			taxCode: string;
			color: string;
			domain?: string;
		}) => {
			const res = await fetch("/api/admin/company-colors", {
				method: "POST",
				body: JSON.stringify({ taxCode, color, domain }),
				headers: { "Content-Type": "application/json" },
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.details || err.error || "Update failed");
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["company-colors"] });
			toast.success("Settings updated");
		},
		onError: (err: any) => {
			console.error("Mutation error:", err);
			toast.error(err.message || "Action failed");
		},
	});

	const handleAddOrEdit = () => {
		if (!selectedPartnerId) return;
		// Send domain along with taxCode and color
		console.log(
			"Adding with domain:",
			selectedPartnerDomain,
			"for taxCode:",
			selectedPartnerId,
		);
		mutation.mutate({
			taxCode: selectedPartnerId,
			color: "default",
			domain: selectedPartnerDomain,
		});
		setSelectedPartnerId("");
		setSelectedPartnerDomain(undefined);
	};

	// Merge API colors with Partner names for display
	// Use partners first, then fallback to companies from API (for cross-domain ADMIN view)
	const configs = useMemo(() => {
		const savedColors = apiData?.colors || [];
		const apiCompanies = apiData?.companies || [];

		const list = savedColors.map((c: any) => {
			// Try to find in partners first
			const partner = partners.find((p) => p.id === c.taxCode);
			// Fallback to companies from API (contains names from FollowUp records)
			const apiCompany = apiCompanies.find(
				(comp: any) => comp.taxCode === c.taxCode,
			);

			return {
				...c,
				displayName: partner?.name || apiCompany?.name || c.taxCode,
				taxCode: c.taxCode,
				createdByName: c.user?.name || c.user?.email || "Unknown",
			};
		});

		if (!listFilter) return list;
		return list.filter(
			(c: any) =>
				c.displayName.toLowerCase().includes(listFilter.toLowerCase()) ||
				c.taxCode.toLowerCase().includes(listFilter.toLowerCase()),
		);
	}, [apiData, partners, listFilter]);

	if (isLoadingColors || isLoadingPartners) {
		return (
			<div className="flex items-center justify-center py-20">
				<Spinner className="size-8 text-primary" />
			</div>
		);
	}

	if (loadError) {
		return (
			<div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
				<p className="font-bold border-b border-destructive/20 pb-2 mb-2">
					Error loading data:
				</p>
				<p className="text-sm font-mono">{loadError.message}</p>
			</div>
		);
	}

	return (
		<div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-8 md:pb-12">
			<div className="bg-white dark:bg-gray-800 p-4 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
				<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 md:gap-8">
					<div className="max-w-xl space-y-2">
						<div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-1">
							<Palette className="size-4 md:size-5" />
							<span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">
								Appearance
							</span>
						</div>
						<h2 className="text-2xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white">
							Badge Personalization
						</h2>
						<p className="text-muted-foreground leading-relaxed text-xs md:text-sm lg:text-base">
							Persist colors by Tax Code to ensure consistency even if company
							names change.
						</p>
					</div>

					<div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 md:gap-3 w-full lg:w-auto">
						<div className="flex-1 sm:w-[350px]">
							<PartnerCombobox
								label="Add Company Color"
								value={selectedPartnerId}
								onChange={setSelectedPartnerId}
								onPartnerSelect={(partner) => {
									console.log("Partner selected:", partner);
									setSelectedPartnerDomain(partner?.domain);
								}}
							/>
						</div>
						<Button
							onClick={handleAddOrEdit}
							disabled={!selectedPartnerId || mutation.isPending}
							className="h-9 md:h-10 px-4 md:px-8 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white text-sm md:text-base"
						>
							{mutation.isPending && (
								<Spinner className="mr-2 size-3 md:size-4" />
							)}
							<Plus className="mr-1 md:mr-2 size-3 md:size-4" />
							<span className="hidden sm:inline">Add/Edit</span>
							<span className="sm:hidden">Add</span>
						</Button>
					</div>
				</div>
			</div>

			<div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
				<div className="p-4 md:p-6 border-b border-gray-50 dark:border-gray-700/50 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 bg-gray-50/30 dark:bg-gray-900/10">
					<div className="flex items-center gap-2 md:gap-4">
						<div className="p-2 md:p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
							<Building2 className="size-4 md:size-5 text-gray-600 dark:text-gray-400" />
						</div>
						<div>
							<h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">
								Active Configurations
							</h3>
							<p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-widest">
								{configs.length} companies customized
							</p>
						</div>
					</div>

					<div className="relative w-full md:w-64">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<Input
							placeholder="Filter list..."
							value={listFilter}
							onChange={(e) => setListFilter(e.target.value)}
							className="h-9 md:h-10 pl-10 text-sm rounded-xl border-gray-100 dark:border-gray-700 bg-white/50 backdrop-blur-sm"
						/>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-left border-collapse text-xs md:text-sm">
						<thead>
							<tr className="bg-gray-50/50 dark:bg-gray-900/20">
								<th className="px-3 md:px-6 py-2 md:py-4 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Company (Tax Code)
								</th>
								{isAdmin && (
									<th className="hidden md:table-cell px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
										Site
									</th>
								)}
								<th className="px-3 md:px-6 py-2 md:py-4 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">
									Preview
								</th>
								<th className="hidden sm:table-cell px-3 md:px-6 py-2 md:py-4 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Color
								</th>
								<th className="hidden lg:table-cell px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Created By
								</th>
								<th className="px-3 md:px-6 py-2 md:py-4 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-50 dark:divide-gray-800">
							{configs.length > 0 ? (
								configs.map((item: any) => (
									<tr
										key={item.id}
										className="group hover:bg-gray-50/30 dark:hover:bg-gray-900/10 transition-colors"
									>
										<td className="px-3 md:px-6 py-2 md:py-4">
											<div className="flex flex-col gap-0.5">
												<span className="font-bold text-gray-900 dark:text-gray-100 line-clamp-1 max-w-[120px] md:max-w-md text-xs md:text-base">
													{item.displayName}
												</span>
												<span className="text-[7px] md:text-[10px] font-mono text-muted-foreground bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded w-fit">
													{item.taxCode.substring(0, 10)}
												</span>
											</div>
										</td>
										{isAdmin && (
											<td className="hidden md:table-cell px-6 py-4">
												<Badge variant="outline" className="font-bold text-xs">
													{item.domain || "—"}
												</Badge>
											</td>
										)}
										<td className="px-3 md:px-6 py-2 md:py-4 text-center">
											<Badge
												variant={item.color as any}
												className="font-black text-[7px] md:text-[10px] uppercase px-2 md:px-3 py-1 rounded-lg shadow-sm truncate inline-block max-w-[80px] md:max-w-[150px]"
											>
												{item.displayName.length > 15
													? `${item.displayName.slice(0, 12)}...`
													: item.displayName}
											</Badge>
										</td>
										<td className="hidden sm:table-cell px-3 md:px-6 py-2 md:py-4">
											<div className="w-32 md:w-48">
												<Select
													value={item.color}
													onValueChange={(val: unknown) =>
														mutation.mutate({
															taxCode: item.taxCode,
															color: val as string,
															domain: item.domain,
														})
													}
												>
													<SelectTrigger className="h-8 md:h-9 rounded-xl bg-gray-50/50 dark:bg-gray-900/50 border-none hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-semibold text-xs text-gray-700 dark:text-gray-300">
														<SelectValue />
													</SelectTrigger>
													<SelectPositioner className="z-[110]">
														<SelectContent className="rounded-2xl p-2 border-gray-100 dark:border-gray-800 shadow-2xl">
															{BADGE_VARIANTS.map((v) => (
																<SelectItem
																	key={v}
																	value={v}
																	className="rounded-xl my-0.5"
																>
																	<div className="flex items-center gap-3">
																		<div
																			className="size-3 rounded-full shadow-sm"
																			style={{
																				backgroundColor: VARIANT_COLOR_HEX[v],
																			}}
																		/>
																		<span className="capitalize text-xs font-bold">
																			{v}
																		</span>
																	</div>
																</SelectItem>
															))}
														</SelectContent>
													</SelectPositioner>
												</Select>
											</div>
										</td>
										<td className="hidden lg:table-cell px-6 py-4">
											<span className="text-sm text-muted-foreground">
												{item.createdByName}
											</span>
										</td>
										<td className="px-3 md:px-6 py-2 md:py-4 text-right">
											<Button
												variant="ghost"
												size="icon"
												className="size-7 md:size-9 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
												onClick={() =>
													setDeleteConfirm({
														open: true,
														taxCode: item.taxCode,
														displayName: item.displayName,
													})
												}
												title="Remove customization"
											>
												<Trash2 className="size-3 md:size-4" />
											</Button>
										</td>
									</tr>
								))
							) : (
								<tr>
									<td
										colSpan={isAdmin ? 6 : 5}
										className="px-3 md:px-6 py-12 md:py-24 text-center"
									>
										<div className="flex flex-col items-center justify-center opacity-40">
											<Building2 className="size-12 md:size-16 mb-4 text-gray-300" />
											<p className="text-base md:text-lg font-bold">
												No results found
											</p>
											<p className="text-xs md:text-sm">
												Try adjusting your filter or add a new company
											</p>
										</div>
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={deleteConfirm.open}
				onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, open }))}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
							<AlertTriangle className="size-6 text-red-600 dark:text-red-400" />
						</div>
						<DialogTitle className="text-center">Confirm Deletion</DialogTitle>
						<DialogDescription className="text-center">
							Are you sure you want to remove the color customization for{" "}
							<span className="font-semibold text-foreground">
								{deleteConfirm.displayName}
							</span>
							?
							<br />
							<span className="text-xs text-muted-foreground">
								This action cannot be undone.
							</span>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="sm:justify-center gap-3 mt-4">
						<Button
							variant="outline"
							className="rounded-xl"
							onClick={() =>
								setDeleteConfirm({ open: false, taxCode: "", displayName: "" })
							}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							className="rounded-xl"
							onClick={() => {
								mutation.mutate({ taxCode: deleteConfirm.taxCode, color: "" });
								setDeleteConfirm({ open: false, taxCode: "", displayName: "" });
							}}
						>
							<Trash2 className="mr-2 size-4" />
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
