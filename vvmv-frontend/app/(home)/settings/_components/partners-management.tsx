"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Building2,
	Check,
	Database,
	Eye,
	EyeOff,
	Loader2,
	Pencil,
	Plus,
	Search,
	ShieldCheck,
	Sparkles,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { UserDisplay } from "@/components/ui/user-display";
import { usePartners } from "@/hooks/use-partners";
import { useSession } from "@/lib/auth-client";

type Site = "SGN" | "HAN" | "DAD";

interface PartnerData {
	id: string;
	taxCode: string | null;
	fullName: string | null;
	cccd: string | null;
	ddInfo: string | null;
	invoiceData: string | null;
	ewmsPass: string | null;
	maHQ: string | null;
	site: Site;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	user?: {
		id: string;
		name: string | null;
		email: string;
	} | null;
	enableKVGS: boolean;
	enableCDS: boolean;
	vatType: string | null;
	creditOnlyFeeCodes: string[];
}

interface VendorFeeTypeOption {
	id: string;
	feeCode: string;
	name: string;
	site: string;
}

const SITE_COLORS: Record<Site, string> = {
	SGN: "bg-gradient-to-r from-red-500 to-orange-500 text-white",
	HAN: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
	DAD: "bg-gradient-to-r from-teal-500 to-cyan-500 text-white",
};

// Helper for parsing/composing DD Info connection string
const parseDDInfo = (str: string | null) => {
	const parts = (str || "").split(";").reduce(
		(acc, part) => {
			const [key, ...val] = part.split("=");
			if (key && val.length > 0) acc[key.trim()] = val.join("=").trim();
			return acc;
		},
		{} as Record<string, string>,
	);

	return {
		dataSource: parts["Data Source"] || "",
		catalog: parts["Initial Catalog"] || "",
		userId: parts["User ID"] || "",
		password: parts.Password || "",
		encrypt: parts.Encrypt || "False",
	};
};

const composeDDInfo = (data: {
	dataSource: string;
	catalog: string;
	userId: string;
	password: string;
	encrypt: string;
}) => {
	const parts = [
		`Data Source=${data.dataSource}`,
		`Initial Catalog=${data.catalog}`,
		`User ID=${data.userId}`,
		`Password=${data.password}`,
		`Encrypt=${data.encrypt || "False"}`,
	];
	return parts.join(";");
};

interface PartnersManagementProps {
	isAdminOnly?: boolean;
}

/** Matches GET `/api/admin/partners-master-data` default page size and safe UI fallback */
const PARTNERS_LIST_PAGE_SIZE = 10;

export function PartnersManagement({
	isAdminOnly = true,
}: PartnersManagementProps) {
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	const userSite = (session?.user as any)?.site as Site | undefined;
	const canViewAllSites = isSuperAdmin;
	const canEditAllSites = canViewAllSites; // Only SUPERADMIN can edit across sites

	const { partners: allPartners } = usePartners();

	const [page, setPage] = useState(1);
	const [listFilter, setListFilter] = useState("");
	const [debouncedFilter, setDebouncedFilter] = useState("");
	const [siteFilter, setSiteFilter] = useState<Site>();

	const [editingId, setEditingId] = useState<string | null>(null);
	const [editForm, setEditForm] = useState({
		taxCode: "",
		fullName: "",
		cccd: "",
		ddInfo: "",
		invoiceData: "",
		ewmsPass: "",
		maHQ: "",
		site: "SGN" as Site,
		enableKVGS: true,
		enableCDS: true,
		vatType: "",
		creditOnlyFeeCodes: [] as string[],
	});

	// Debounce filter - increased to 1000ms for heavy ERP cross-referencing
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedFilter(listFilter);
			setPage(1); // Reset to first page on search
		}, 1000);
		return () => clearTimeout(timer);
	}, [listFilter]);

	// Memoize partners map for instant lookup (O(1) instead of O(N))
	const partnerNameMap = useMemo(() => {
		const map = new Map<string, string>();
		allPartners.forEach((p) => {
			if (p.id) map.set(p.id, p.name);
		});
		return map;
	}, [allPartners]);

	// Reset page when site filter changes
	const handleSiteChange = (val: Site) => {
		setSiteFilter(val);
		setPage(1);
	};
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [addForm, setAddForm] = useState({
		taxCode: "",
		fullName: "",
		cccd: "",
		ddInfo: "",
		invoiceData: "",
		ewmsPass: "",
		maHQ: "",
		site: (userSite || "SGN") as Site,
		enableKVGS: true,
		enableCDS: true,
		vatType: "",
		creditOnlyFeeCodes: [] as string[],
	});
	const [showEditPassword, setShowEditPassword] = useState(false);
	const [showAddPassword, setShowAddPassword] = useState(false);
	// ERP name suggestion state for Add dialog
	const [erpSuggestion, setErpSuggestion] = useState<{
		loading: boolean;
		name: string | null;
	}>({ loading: false, name: null });
	const [fetchingPassword, setFetchingPassword] = useState(false);
	const [passwordFetched, setPasswordFetched] = useState(false);
	// State for view mode password visibility (per partner)
	const [viewPasswordState, setViewPasswordState] = useState<{
		[partnerId: string]: {
			visible: boolean;
			password: string;
			loading: boolean;
			fetched: boolean;
		};
	}>({});
	const [deleteConfirm, setDeleteConfirm] = useState<{
		open: boolean;
		id: string;
		taxCode: string;
	}>({ open: false, id: "", taxCode: "" });

	// Fetch partners data
	const {
		data: apiData,
		isLoading,
		error: loadError,
		isFetching,
	} = useQuery({
		queryKey: ["partners-master-data", page, debouncedFilter, siteFilter],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: page.toString(),
				pageSize: String(PARTNERS_LIST_PAGE_SIZE),
				search: debouncedFilter,
				...(siteFilter && { site: siteFilter }),
			});
			const res = await fetch(`/api/admin/partners-master-data?${params}`);
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.details || err.error || "Failed to fetch partners");
			}
			return res.json();
		},
	});

	// Fetch VendorFeeType options for creditOnlyFeeCodes multiselect
	const { data: feeTypesData } = useQuery({
		queryKey: ["vendor-fee-types", siteFilter || userSite || "SGN"],
		queryFn: async () => {
			const params = new URLSearchParams({
				...(siteFilter && { site: siteFilter }),
			});
			const res = await fetch(`/api/admin/vendor-fee-types?${params}`);
			if (!res.ok) return { feeTypes: [] };
			return res.json();
		},
	});
	const vendorFeeTypeOptions: VendorFeeTypeOption[] =
		feeTypesData?.feeTypes ?? [];

	// Create mutation
	const createMutation = useMutation({
		mutationFn: async (data: {
			taxCode: string;
			fullName: string;
			cccd: string;
			ddInfo: string;
			invoiceData: string;
			ewmsPass: string;
			maHQ: string;
			site: Site;
			enableKVGS: boolean;
			enableCDS: boolean;
			vatType: string;
			creditOnlyFeeCodes: string[];
		}) => {
			const res = await fetch("/api/admin/partners-master-data", {
				method: "POST",
				body: JSON.stringify(data),
				headers: { "Content-Type": "application/json" },
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.details || err.error || "Create failed");
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["partners-master-data"] });
			toast.success("Partner added successfully");
			setAddDialogOpen(false);
			setAddForm({
				taxCode: "",
				fullName: "",
				cccd: "",
				ddInfo: "",
				invoiceData: "",
				ewmsPass: "",
				maHQ: "",
				site: userSite || "SGN",
				enableKVGS: true,
				enableCDS: true,
				vatType: "",
				creditOnlyFeeCodes: [],
			});
		},
		onError: (err: any) => {
			toast.error(err.message || "Failed to add partner");
		},
	});

	// Update mutation
	const updateMutation = useMutation({
		mutationFn: async (data: {
			id: string;
			taxCode?: string;
			fullName?: string;
			cccd?: string;
			ddInfo?: string;
			invoiceData?: string;
			ewmsPass?: string;
			maHQ?: string;
			site?: Site;
			enableKVGS?: boolean;
			enableCDS?: boolean;
			vatType?: string;
			creditOnlyFeeCodes?: string[];
		}) => {
			const res = await fetch("/api/admin/partners-master-data", {
				method: "PUT",
				body: JSON.stringify(data),
				headers: { "Content-Type": "application/json" },
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.details || err.error || "Update failed");
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["partners-master-data"] });
			toast.success("Partner updated successfully");
			setEditingId(null);
		},
		onError: (err: any) => {
			toast.error(err.message || "Failed to update partner");
		},
	});

	// Delete mutation
	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/admin/partners-master-data?id=${id}`, {
				method: "DELETE",
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.details || err.error || "Delete failed");
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["partners-master-data"] });
			toast.success("Partner deleted successfully");
			setDeleteConfirm({ open: false, id: "", taxCode: "" });
		},
		onError: (err: any) => {
			toast.error(err.message || "Failed to delete partner");
		},
	});

	const partners = apiData?.partners || [];
	const pagination = useMemo(() => {
		const p = apiData?.pagination;
		const pageSize = Math.max(
			1,
			Math.floor(Number(p?.pageSize)) || PARTNERS_LIST_PAGE_SIZE,
		);
		const total = Math.max(0, Math.floor(Number(p?.total)) || 0);
		const totalPages = Math.max(1, Math.floor(Number(p?.totalPages)) || 1);
		return { pageSize, total, totalPages };
	}, [apiData?.pagination]);

	const currentPage = Math.max(1, Math.floor(Number(page)) || 1);

	const startEdit = (partner: PartnerData) => {
		setEditingId(partner.id);
		setEditForm({
			taxCode: partner.taxCode || "",
			fullName: partner.fullName || "",
			cccd: partner.cccd || "",
			ddInfo: partner.ddInfo || "",
			invoiceData: partner.invoiceData || "",
			ewmsPass: partner.ewmsPass || "",
			maHQ: partner.maHQ || "",
			site: partner.site,
			enableKVGS: partner.enableKVGS,
			enableCDS: partner.enableCDS,
			vatType: partner.vatType || "",
			creditOnlyFeeCodes: partner.creditOnlyFeeCodes || [],
		});
		// Reset password state when starting edit
		setShowEditPassword(false);
		setPasswordFetched(false);
	};

	// Fetch real password from API when clicking eye icon
	const fetchRealPassword = useCallback(
		async (partnerId: string) => {
			if (passwordFetched || fetchingPassword) {
				// Password already fetched, just toggle visibility
				setShowEditPassword(!showEditPassword);
				return;
			}

			setFetchingPassword(true);
			try {
				const res = await fetch(
					`/api/admin/partners-master-data/password?id=${partnerId}`,
				);
				if (!res.ok) {
					const err = await res.json();
					throw new Error(err.error || "Failed to fetch password");
				}
				const data = await res.json();

				// Update the editForm with the real password
				const current = parseDDInfo(editForm.ddInfo);
				setEditForm((f) => ({
					...f,
					ddInfo: composeDDInfo({
						...current,
						password: data.password || "",
					}),
				}));

				setPasswordFetched(true);
				setShowEditPassword(true);
			} catch (error: any) {
				toast.error(error.message || "Cannot fetch password");
			} finally {
				setFetchingPassword(false);
			}
		},
		[passwordFetched, fetchingPassword, showEditPassword, editForm.ddInfo],
	);

	const cancelEdit = () => {
		setEditingId(null);
		setShowEditPassword(false);
		setPasswordFetched(false);
	};

	const saveEdit = () => {
		if (!editingId) return;
		updateMutation.mutate({
			id: editingId,
			taxCode: editForm.taxCode,
			fullName: editForm.fullName,
			cccd: editForm.cccd,
			ddInfo: editForm.ddInfo,
			invoiceData: editForm.invoiceData,
			ewmsPass: editForm.ewmsPass,
			maHQ: editForm.maHQ,
			site: editForm.site,
			enableKVGS: editForm.enableKVGS,
			enableCDS: editForm.enableCDS,
			vatType: editForm.vatType,
			creditOnlyFeeCodes: editForm.creditOnlyFeeCodes,
		});
	};

	if (isLoading) {
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
		<div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-12">
			{/* Header */}
			<div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
				<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
					<div className="max-w-xl space-y-2">
						<div className="flex items-center gap-3 text-purple-600 dark:text-purple-400 mb-1">
							<Users className="size-5" />
							<span className="text-xs font-black uppercase tracking-[0.2em]">
								Master Data
							</span>
						</div>
						<h2 className="text-4xl font-black tracking-tighter text-gray-900 dark:text-white">
							Partners Management
						</h2>
						<p className="text-muted-foreground leading-relaxed text-sm md:text-base">
							Manage partner information including Tax Code, CCCD, and DD Info.
							{canViewAllSites
								? " As Admin with ALL site access, you can view and edit all sites."
								: isAdmin
									? ` As Admin for ${userSite}, you can only manage partners from your site.`
									: ` You can only manage partners from your site (${userSite}).`}
						</p>
					</div>

					<Button
						onClick={() => setAddDialogOpen(true)}
						className="h-10 px-8 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-purple-500/20 bg-purple-600 hover:bg-purple-700 text-white"
					>
						<Plus className="mr-2 size-4" />
						Add Partner
					</Button>
				</div>
			</div>

			{/* Table */}
			<div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
				<div className="p-6 border-b border-gray-50 dark:border-gray-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/30 dark:bg-gray-900/10">
					<div className="flex items-center gap-4">
						<div className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
							<Building2 className="size-5 text-gray-600 dark:text-gray-400" />
						</div>
						<div>
							<h3 className="text-lg font-bold text-gray-900 dark:text-white">
								Partners List
							</h3>
							<p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
								{pagination.total} partners
							</p>
							{isFetching && !isLoading && (
								<Spinner className="size-3 text-primary absolute -top-1 -right-4" />
							)}
						</div>
					</div>

					<div className="flex flex-col sm:flex-row gap-3">
						{/* Site Filter (SUPERADMIN only) */}
						{canViewAllSites && (
							<Select
								value={siteFilter}
								onValueChange={(val) => handleSiteChange(val as Site)}
							>
								<SelectTrigger className="h-10 w-32 rounded-xl">
									<SelectValue placeholder="Site" />
								</SelectTrigger>
								<SelectPositioner className="z-[110]">
									<SelectContent className="rounded-xl">
										<SelectItem value="SGN">SGN</SelectItem>
										<SelectItem value="HAN">HAN</SelectItem>
										<SelectItem value="DAD">DAD</SelectItem>
									</SelectContent>
								</SelectPositioner>
							</Select>
						)}

						{/* Search */}
						<div className="relative w-full md:w-64">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
							<Input
								placeholder="Search..."
								value={listFilter}
								onChange={(e) => setListFilter(e.target.value)}
								className="h-10 pl-10 rounded-xl border-gray-100 dark:border-gray-700 bg-white/50 backdrop-blur-sm"
							/>
						</div>
					</div>
				</div>

				<div className="hidden md:block overflow-x-auto">
					<table className="w-full text-left border-collapse min-w-[1500px]">
						<thead>
							<tr className="bg-gray-50/50 dark:bg-gray-900/20">
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Tax Code
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Company Name
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Full Name (ERP)
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									CCCD
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									DD Info
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Thông tin xuất HĐ
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									EWMS Pass
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Mã HQ
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
									VAT Type
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
									Credit-Only Fees
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Site
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">
									KVGS
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">
									CDS
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Created By
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-50 dark:divide-gray-800">
							{partners.length > 0 ? (
								partners.map((partner: PartnerData) => (
									<tr
										key={partner.id}
										className="group hover:bg-gray-50/30 dark:hover:bg-gray-900/10 transition-colors"
									>
										{editingId === partner.id ? (
											// Edit mode
											<>
												<td className="px-6 py-4">
													<Input
														value={editForm.taxCode}
														onChange={(e) =>
															setEditForm((f) => ({
																...f,
																taxCode: e.target.value,
															}))
														}
														className="h-8 rounded-lg text-sm"
														placeholder="Tax Code"
													/>
												</td>
												<td className="px-6 py-4">
													<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
														{editForm.taxCode
															? partnerNameMap.get(editForm.taxCode) || "—"
															: "—"}
													</span>
												</td>
												<td className="px-6 py-4">
													<Input
														value={editForm.fullName}
														onChange={(e) =>
															setEditForm((f) => ({
																...f,
																fullName: e.target.value,
															}))
														}
														className="h-8 rounded-lg text-sm min-w-[160px]"
														placeholder="Full Name"
													/>
												</td>
												<td className="px-6 py-4">
													<Input
														value={editForm.cccd}
														onChange={(e) =>
															setEditForm((f) => ({
																...f,
																cccd: e.target.value,
															}))
														}
														className="h-8 rounded-lg text-sm"
														placeholder="CCCD"
													/>
												</td>
												<td className="px-6 py-4">
													<div className="space-y-2 min-w-[200px]">
														<Input
															value={parseDDInfo(editForm.ddInfo).dataSource}
															onChange={(e) => {
																const current = parseDDInfo(editForm.ddInfo);
																setEditForm((f) => ({
																	...f,
																	ddInfo: composeDDInfo({
																		...current,
																		dataSource: e.target.value,
																	}),
																}));
															}}
															className="h-7 text-[11px] rounded-md"
															placeholder="Server/IP"
														/>
														<Input
															value={parseDDInfo(editForm.ddInfo).catalog}
															onChange={(e) => {
																const current = parseDDInfo(editForm.ddInfo);
																setEditForm((f) => ({
																	...f,
																	ddInfo: composeDDInfo({
																		...current,
																		catalog: e.target.value,
																	}),
																}));
															}}
															className="h-7 text-[11px] rounded-md"
															placeholder="Database"
														/>
														<Input
															value={parseDDInfo(editForm.ddInfo).userId}
															onChange={(e) => {
																const current = parseDDInfo(editForm.ddInfo);
																setEditForm((f) => ({
																	...f,
																	ddInfo: composeDDInfo({
																		...current,
																		userId: e.target.value,
																	}),
																}));
															}}
															className="h-7 text-[11px] rounded-md"
															placeholder="User ID"
														/>
														{isAdminOnly && (
															<div className="relative">
																<Input
																	type={showEditPassword ? "text" : "password"}
																	value={parseDDInfo(editForm.ddInfo).password}
																	onChange={(e) => {
																		const current = parseDDInfo(
																			editForm.ddInfo,
																		);
																		setEditForm((f) => ({
																			...f,
																			ddInfo: composeDDInfo({
																				...current,
																				password: e.target.value,
																			}),
																		}));
																	}}
																	className="h-7 text-[11px] rounded-md pr-7"
																	placeholder="Password"
																/>
																<button
																	type="button"
																	onClick={() => {
																		if (editingId && !passwordFetched) {
																			fetchRealPassword(editingId);
																		} else {
																			setShowEditPassword(!showEditPassword);
																		}
																	}}
																	disabled={fetchingPassword}
																	className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
																>
																	{fetchingPassword ? (
																		<Spinner className="size-3.5" />
																	) : showEditPassword ? (
																		<EyeOff className="size-3.5" />
																	) : (
																		<Eye className="size-3.5" />
																	)}
																</button>
															</div>
														)}
													</div>
												</td>
												{/* Invoice Data edit cell */}
												<td className="px-6 py-4">
													<textarea
														value={editForm.invoiceData}
														onChange={(e) =>
															setEditForm((f) => ({
																...f,
																invoiceData: e.target.value,
															}))
														}
														rows={3}
														className="w-full min-w-[200px] rounded-lg border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
														placeholder="Tên công ty, địa chỉ, MST..."
													/>
												</td>
												{/* EWMS Pass edit cell */}
												<td className="px-6 py-4">
													<Input
														value={editForm.ewmsPass}
														onChange={(e) =>
															setEditForm((f) => ({
																...f,
																ewmsPass: e.target.value,
															}))
														}
														className="h-8 rounded-lg text-sm min-w-[120px]"
														placeholder="EWMS Pass"
													/>
												</td>
												{/* Mã HQ edit cell */}
												<td className="px-6 py-4">
													<Input
														value={editForm.maHQ}
														onChange={(e) =>
															setEditForm((f) => ({
																...f,
																maHQ: e.target.value,
															}))
														}
														className="h-8 rounded-lg text-sm min-w-[120px]"
														placeholder="Mã HQ"
													/>
												</td>
												<td className="px-6 py-4">
													<Select
														value={editForm.vatType}
														onValueChange={(val) =>
															setEditForm((f) => ({
																...f,
																vatType: val as string,
															}))
														}
													>
														<SelectTrigger className="h-8 rounded-lg text-xs min-w-[160px]">
															<SelectValue placeholder="Chọn loại VAT" />
														</SelectTrigger>
														<SelectPositioner className="z-[110]">
															<SelectContent className="rounded-xl">
																<SelectItem value="">— Bỏ chọn —</SelectItem>
																<SelectItem value="SAU VAT CÓ VAT">
																	SAU VAT CÓ VAT
																</SelectItem>
																<SelectItem value="TRƯỚC VAT CÓ VAT">
																	TRƯỚC VAT CÓ VAT
																</SelectItem>
																<SelectItem value="TRƯỚC VAT KHÔNG VAT">
																	TRƯỚC VAT KHÔNG VAT
																</SelectItem>
																<SelectItem value="SAU VAT KHÔNG VAT">
																	SAU VAT KHÔNG VAT
																</SelectItem>
															</SelectContent>
														</SelectPositioner>
													</Select>
												</td>
												{/* Credit-Only Fee Codes edit cell */}
												<td className="px-6 py-4">
													<div className="min-w-[200px] space-y-1">
														{vendorFeeTypeOptions.length === 0 ? (
															<span className="text-xs text-muted-foreground italic">
																No fee types
															</span>
														) : (
															vendorFeeTypeOptions.map((ft) => (
																<label
																	key={ft.id}
																	className="flex items-center gap-2 cursor-pointer group"
																>
																	<Checkbox
																		checked={editForm.creditOnlyFeeCodes.includes(
																			ft.feeCode,
																		)}
																		onCheckedChange={(checked) =>
																			setEditForm((f) => ({
																				...f,
																				creditOnlyFeeCodes: checked
																					? [
																							...f.creditOnlyFeeCodes,
																							ft.feeCode,
																						]
																					: f.creditOnlyFeeCodes.filter(
																							(c) => c !== ft.feeCode,
																						),
																			}))
																		}
																	/>
																	<span className="text-[11px] font-mono text-gray-700 dark:text-gray-300 group-hover:text-purple-600 transition-colors">
																		{ft.feeCode}
																		<span className="text-[10px] text-muted-foreground ml-1 font-sans">
																			{ft.name}
																		</span>
																	</span>
																</label>
															))
														)}
													</div>
												</td>
												<td className="px-6 py-4">
													{canEditAllSites ? (
														<Select
															value={editForm.site}
															onValueChange={(val) =>
																setEditForm((f) => ({
																	...f,
																	site: val as Site,
																}))
															}
														>
															<SelectTrigger className="h-8 w-24 rounded-lg text-xs">
																<SelectValue />
															</SelectTrigger>
															<SelectPositioner className="z-[110]">
																<SelectContent className="rounded-xl">
																	<SelectItem value="SGN">SGN</SelectItem>
																	<SelectItem value="HAN">HAN</SelectItem>
																	<SelectItem value="DAD">DAD</SelectItem>
																</SelectContent>
															</SelectPositioner>
														</Select>
													) : (
														<Badge
															className={`${SITE_COLORS[partner.site]} text-xs font-bold px-3 py-1 rounded-lg`}
														>
															{partner.site}
														</Badge>
													)}
												</td>
												<td className="px-6 py-4">
													<div className="flex justify-center items-center">
														<Checkbox
															checked={editForm.enableKVGS}
															onCheckedChange={(checked) =>
																setEditForm((f) => ({
																	...f,
																	enableKVGS: !!checked,
																}))
															}
														/>
													</div>
												</td>
												<td className="px-6 py-4">
													<div className="flex justify-center items-center">
														<Checkbox
															checked={editForm.enableCDS}
															onCheckedChange={(checked) =>
																setEditForm((f) => ({
																	...f,
																	enableCDS: !!checked,
																}))
															}
														/>
													</div>
												</td>
												<td className="px-6 py-4">
													<UserDisplay
														user={partner.user}
														size="sm"
														showEmail={false}
													/>
												</td>
												<td className="px-6 py-4 text-right">
													<div className="flex justify-end gap-2">
														<Button
															variant="ghost"
															size="icon"
															className="size-8 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
															onClick={saveEdit}
															disabled={updateMutation.isPending}
														>
															{updateMutation.isPending ? (
																<Spinner className="size-4" />
															) : (
																<Check className="size-4" />
															)}
														</Button>
														<Button
															variant="ghost"
															size="icon"
															className="size-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
															onClick={cancelEdit}
														>
															<X className="size-4" />
														</Button>
													</div>
												</td>
											</>
										) : (
											// View mode
											<>
												<td className="px-6 py-4">
													<span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
														{partner.taxCode || "—"}
													</span>
												</td>
												<td className="px-6 py-4">
													<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
														{partner.taxCode
															? partnerNameMap.get(partner.taxCode) || "—"
															: "—"}
													</span>
												</td>
												<td className="px-6 py-4">
													<span className="text-sm text-gray-500 dark:text-gray-400 italic">
														{partner.fullName || "—"}
													</span>
												</td>
												<td className="px-6 py-4">
													<span className="text-sm text-gray-700 dark:text-gray-300">
														{partner.cccd || "—"}
													</span>
												</td>
												<td className="px-6 py-4">
													{partner.ddInfo ? (
														<div className="text-[11px] space-y-0.5 text-muted-foreground border-l-2 border-blue-100 dark:border-blue-900 pl-2 py-0.5">
															<div className="flex gap-1">
																<span className="font-bold text-gray-400">
																	SRV:
																</span>
																<span className="text-gray-900 dark:text-gray-100">
																	{parseDDInfo(partner.ddInfo).dataSource}
																</span>
															</div>
															<div className="flex gap-1">
																<span className="font-bold text-gray-400">
																	DB:
																</span>
																<span className="text-gray-900 dark:text-gray-100">
																	{parseDDInfo(partner.ddInfo).catalog}
																</span>
															</div>
															<div className="flex gap-1">
																<span className="font-bold text-gray-400">
																	UID:
																</span>
																<span className="text-gray-900 dark:text-gray-100">
																	{parseDDInfo(partner.ddInfo).userId}
																</span>
															</div>
															{isAdminOnly && (
																<div className="flex gap-1 items-center">
																	<span className="font-bold text-gray-400">
																		PWD:
																	</span>
																	{viewPasswordState[partner.id]?.visible ? (
																		<span className="text-gray-900 dark:text-gray-100 font-mono">
																			{viewPasswordState[partner.id]
																				?.password || "—"}
																		</span>
																	) : (
																		<span className="text-gray-500">
																			••••••••
																		</span>
																	)}
																	<button
																		type="button"
																		onClick={async () => {
																			const state =
																				viewPasswordState[partner.id];
																			if (state?.fetched) {
																				// Already fetched, just toggle visibility
																				setViewPasswordState((prev) => ({
																					...prev,
																					[partner.id]: {
																						...state,
																						visible: !state.visible,
																					},
																				}));
																				return;
																			}
																			// Fetch password from API
																			setViewPasswordState((prev) => ({
																				...prev,
																				[partner.id]: {
																					visible: false,
																					password: "",
																					loading: true,
																					fetched: false,
																				},
																			}));
																			try {
																				const res = await fetch(
																					`/api/admin/partners-master-data/password?id=${partner.id}`,
																				);
																				if (!res.ok) {
																					const err = await res.json();
																					throw new Error(
																						err.error ||
																							"Failed to fetch password",
																					);
																				}
																				const data = await res.json();
																				setViewPasswordState((prev) => ({
																					...prev,
																					[partner.id]: {
																						visible: true,
																						password: data.password || "",
																						loading: false,
																						fetched: true,
																					},
																				}));
																			} catch (error: any) {
																				toast.error(
																					error.message ||
																						"Cannot fetch password",
																				);
																				setViewPasswordState((prev) => ({
																					...prev,
																					[partner.id]: {
																						visible: false,
																						password: "",
																						loading: false,
																						fetched: false,
																					},
																				}));
																			}
																		}}
																		className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
																	>
																		{viewPasswordState[partner.id]?.loading ? (
																			<Spinner className="size-3" />
																		) : viewPasswordState[partner.id]
																				?.visible ? (
																			<EyeOff className="size-3" />
																		) : (
																			<Eye className="size-3" />
																		)}
																	</button>
																</div>
															)}
														</div>
													) : (
														<span className="text-sm text-muted-foreground">
															—
														</span>
													)}
												</td>
												{/* Invoice Data view cell */}
												<td className="px-6 py-4 max-w-[240px]">
													{(partner as any).invoiceData ? (
														<pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed border-l-2 border-emerald-200 dark:border-emerald-800 pl-2 py-0.5">
															{(partner as any).invoiceData}
														</pre>
													) : (
														<span className="text-sm text-muted-foreground">
															—
														</span>
													)}
												</td>
												{/* EWMS Pass view cell */}
												<td className="px-6 py-4">
													<span className="font-mono text-xs text-gray-700 dark:text-gray-300">
														{partner.ewmsPass || "—"}
													</span>
												</td>
												{/* Mã HQ view cell */}
												<td className="px-6 py-4">
													<span className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">
														{partner.maHQ || "—"}
													</span>
												</td>
												<td className="px-6 py-4">
													{partner.vatType ? (
														<Badge className="bg-blue-100/50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 pointer-events-none text-[10px] whitespace-nowrap">
															{partner.vatType}
														</Badge>
													) : (
														<span className="text-sm text-muted-foreground">
															—
														</span>
													)}
												</td>
												{/* Credit-Only Fee Codes view cell */}
												<td className="px-6 py-4">
													{partner.creditOnlyFeeCodes?.length > 0 ? (
														<div className="flex flex-wrap gap-1 max-w-[200px]">
															{partner.creditOnlyFeeCodes.map((code) => (
																<Badge
																	key={code}
																	className="bg-orange-100/60 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 pointer-events-none text-[10px] font-mono px-1.5 py-0.5 rounded"
																>
																	{code}
																</Badge>
															))}
														</div>
													) : (
														<span className="text-sm text-muted-foreground">
															—
														</span>
													)}
												</td>
												<td className="px-6 py-4">
													<Badge
														className={`${SITE_COLORS[partner.site]} text-xs font-bold px-3 py-1 rounded-lg`}
													>
														{partner.site}
													</Badge>
												</td>
												<td className="px-6 py-4 text-center">
													<div className="flex justify-center">
														{partner.enableKVGS ? (
															<div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600">
																<ShieldCheck className="size-4" />
															</div>
														) : (
															<div className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
																<X className="size-4" />
															</div>
														)}
													</div>
												</td>
												<td className="px-6 py-4 text-center">
													<div className="flex justify-center">
														{partner.enableCDS ? (
															<div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600">
																<Database className="size-4" />
															</div>
														) : (
															<div className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
																<X className="size-4" />
															</div>
														)}
													</div>
												</td>
												<td className="px-6 py-4">
													<UserDisplay
														user={partner.user}
														size="sm"
														showEmail={true}
													/>
												</td>
												<td className="px-6 py-4 text-right">
													<div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
														<Button
															variant="ghost"
															size="icon"
															className="size-8 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
															onClick={() => startEdit(partner)}
															title="Edit"
														>
															<Pencil className="size-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															className="size-8 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
															onClick={() =>
																setDeleteConfirm({
																	open: true,
																	id: partner.id,
																	taxCode: partner.taxCode || "N/A",
																})
															}
															title="Delete"
														>
															<Trash2 className="size-4" />
														</Button>
													</div>
												</td>
											</>
										)}
									</tr>
								))
							) : (
								<tr>
									<td colSpan={6} className="px-6 py-24 text-center">
										<div className="flex flex-col items-center justify-center opacity-40">
											<Users className="size-16 mb-4 text-gray-300" />
											<p className="text-lg font-bold">No partners found</p>
											<p className="text-sm">
												Try adjusting your filter or add a new partner
											</p>
										</div>
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				{/* Mobile Card View */}
				<div className="md:hidden space-y-3 px-4">
					{partners.length > 0 ? (
						partners.map((partner: PartnerData) => (
							<div
								key={partner.id}
								className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800/50"
							>
								{editingId === partner.id ? (
									// Edit mode
									<div className="space-y-3">
										{/* Tax Code */}
										<div>
											<label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
												Tax Code
											</label>
											<Input
												value={editForm.taxCode}
												onChange={(e) =>
													setEditForm((f) => ({
														...f,
														taxCode: e.target.value,
													}))
												}
												className="h-8 rounded-lg text-sm"
												placeholder="Tax Code"
											/>
										</div>

										{/* Full Name */}
										<div>
											<label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
												Full Name
											</label>
											<Input
												value={editForm.fullName}
												onChange={(e) =>
													setEditForm((f) => ({
														...f,
														fullName: e.target.value,
													}))
												}
												className="h-8 rounded-lg text-sm"
												placeholder="Full Name"
											/>
										</div>

										{/* CCCD */}
										<div>
											<label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
												CCCD
											</label>
											<Input
												value={editForm.cccd}
												onChange={(e) =>
													setEditForm((f) => ({
														...f,
														cccd: e.target.value,
													}))
												}
												className="h-8 rounded-lg text-sm"
												placeholder="CCCD"
											/>
										</div>

										{/* DD Info */}
										<div className="space-y-2">
											<label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
												DD Info
											</label>
											<Input
												value={parseDDInfo(editForm.ddInfo).dataSource}
												onChange={(e) => {
													const current = parseDDInfo(editForm.ddInfo);
													setEditForm((f) => ({
														...f,
														ddInfo: composeDDInfo({
															...current,
															dataSource: e.target.value,
														}),
													}));
												}}
												className="h-7 text-[11px] rounded-md"
												placeholder="Server/IP"
											/>
											<Input
												value={parseDDInfo(editForm.ddInfo).catalog}
												onChange={(e) => {
													const current = parseDDInfo(editForm.ddInfo);
													setEditForm((f) => ({
														...f,
														ddInfo: composeDDInfo({
															...current,
															catalog: e.target.value,
														}),
													}));
												}}
												className="h-7 text-[11px] rounded-md"
												placeholder="Database"
											/>
											<Input
												value={parseDDInfo(editForm.ddInfo).userId}
												onChange={(e) => {
													const current = parseDDInfo(editForm.ddInfo);
													setEditForm((f) => ({
														...f,
														ddInfo: composeDDInfo({
															...current,
															userId: e.target.value,
														}),
													}));
												}}
												className="h-7 text-[11px] rounded-md"
												placeholder="User ID"
											/>
											{isAdminOnly && (
												<div className="relative">
													<Input
														type={showEditPassword ? "text" : "password"}
														value={parseDDInfo(editForm.ddInfo).password}
														onChange={(e) => {
															const current = parseDDInfo(editForm.ddInfo);
															setEditForm((f) => ({
																...f,
																ddInfo: composeDDInfo({
																	...current,
																	password: e.target.value,
																}),
															}));
														}}
														className="h-7 text-[11px] rounded-md pr-8"
														placeholder="Password"
													/>
													<button
														type="button"
														onClick={() => {
															if (editingId && !passwordFetched) {
																fetchRealPassword(editingId);
															} else {
																setShowEditPassword(!showEditPassword);
															}
														}}
														disabled={fetchingPassword}
														className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
													>
														{fetchingPassword ? (
															<Spinner className="size-4" />
														) : showEditPassword ? (
															<EyeOff className="size-4" />
														) : (
															<Eye className="size-4" />
														)}
													</button>
												</div>
											)}
										</div>

										{/* Invoice Data mobile edit */}
										<div>
											<label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
												Thông tin xuất hóa đơn
											</label>
											<textarea
												value={editForm.invoiceData}
												onChange={(e) =>
													setEditForm((f) => ({
														...f,
														invoiceData: e.target.value,
													}))
												}
												rows={3}
												className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
												placeholder="Tên công ty, địa chỉ, MST..."
											/>
										</div>

										{/* EWMS Pass mobile edit */}
										<div>
											<label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
												EWMS Pass
											</label>
											<Input
												value={editForm.ewmsPass}
												onChange={(e) =>
													setEditForm((f) => ({
														...f,
														ewmsPass: e.target.value,
													}))
												}
												className="h-8 rounded-lg text-sm"
												placeholder="EWMS Pass"
											/>
										</div>

										{/* Mã HQ mobile edit */}
										<div>
											<label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
												Mã HQ
											</label>
											<Input
												value={editForm.maHQ}
												onChange={(e) =>
													setEditForm((f) => ({
														...f,
														maHQ: e.target.value,
													}))
												}
												className="h-8 rounded-lg text-sm"
												placeholder="Mã HQ"
											/>
										</div>

										{/* VAT Type mobile edit */}
										<div>
											<label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
												VAT Type
											</label>
											<Select
												value={editForm.vatType}
												onValueChange={(val) =>
													setEditForm((f) => ({ ...f, vatType: val as string }))
												}
											>
												<SelectTrigger className="h-8 rounded-lg text-sm">
													<SelectValue placeholder="Chọn loại VAT" />
												</SelectTrigger>
												<SelectPositioner className="z-[110]">
													<SelectContent className="rounded-xl">
														<SelectItem value="SAU VAT CÓ VAT">
															SAU VAT CÓ VAT
														</SelectItem>
														<SelectItem value="TRƯỚC VAT CÓ VAT">
															TRƯỚC VAT CÓ VAT
														</SelectItem>
														<SelectItem value="TRƯỚC VAT KHÔNG VAT">
															TRƯỚC VAT KHÔNG VAT
														</SelectItem>
														<SelectItem value="SAU VAT KHÔNG VAT">
															SAU VAT KHÔNG VAT
														</SelectItem>
													</SelectContent>
												</SelectPositioner>
											</Select>
										</div>

										{/* Credit-Only Fees mobile edit */}
										{vendorFeeTypeOptions.length > 0 && (
											<div>
												<label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
													Credit-Only Fees (bỏ OTHERDEBIT)
												</label>
												<div className="space-y-1.5 p-2 rounded-lg bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900/30">
													{vendorFeeTypeOptions.map((ft) => (
														<label
															key={ft.id}
															className="flex items-center gap-2 cursor-pointer"
														>
															<Checkbox
																checked={editForm.creditOnlyFeeCodes.includes(
																	ft.feeCode,
																)}
																onCheckedChange={(checked) =>
																	setEditForm((f) => ({
																		...f,
																		creditOnlyFeeCodes: checked
																			? [...f.creditOnlyFeeCodes, ft.feeCode]
																			: f.creditOnlyFeeCodes.filter(
																					(c) => c !== ft.feeCode,
																				),
																	}))
																}
															/>
															<span className="text-[11px] font-mono text-orange-700 dark:text-orange-300">
																{ft.feeCode}
															</span>
															<span className="text-[10px] text-muted-foreground">
																{ft.name}
															</span>
														</label>
													))}
												</div>
											</div>
										)}

										{/* Flags */}
										<div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-2">
											<label className="flex items-center gap-2 cursor-pointer">
												<Checkbox
													checked={editForm.enableKVGS}
													onCheckedChange={(checked) =>
														setEditForm((f) => ({
															...f,
															enableKVGS: checked === true,
														}))
													}
												/>
												<span className="text-sm text-gray-700 dark:text-gray-300">
													Enable KVGS
												</span>
											</label>
											<label className="flex items-center gap-2 cursor-pointer">
												<Checkbox
													checked={editForm.enableCDS}
													onCheckedChange={(checked) =>
														setEditForm((f) => ({
															...f,
															enableCDS: checked === true,
														}))
													}
												/>
												<span className="text-sm text-gray-700 dark:text-gray-300">
													Enable CDS
												</span>
											</label>
										</div>

										{/* Action Buttons */}
										<div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
											<Button
												variant="ghost"
												size="icon"
												className="size-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
												onClick={cancelEdit}
											>
												<X className="size-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="size-8 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
												onClick={saveEdit}
											>
												{updateMutation.isPending ? (
													<Spinner className="size-4" />
												) : (
													<Check className="size-4" />
												)}
											</Button>
										</div>
									</div>
								) : (
									// View mode
									<div className="space-y-3">
										{/* Header */}
										<div className="flex items-start justify-between gap-2">
											<div className="flex-1 min-w-0">
												<p className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
													{partner.taxCode || "—"}
												</p>
												<p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
													{partner.taxCode
														? partnerNameMap.get(partner.taxCode) || "—"
														: "—"}
												</p>
											</div>
											<Badge
												className={`${SITE_COLORS[partner.site]} text-xs font-bold px-2 py-1 rounded-lg shrink-0`}
											>
												{partner.site}
											</Badge>
										</div>

										{/* Full Name */}
										{partner.fullName && (
											<div className="text-sm">
												<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
													Full Name (ERP)
												</p>
												<p className="text-gray-500 dark:text-gray-400 italic">
													{partner.fullName}
												</p>
											</div>
										)}

										{/* CCCD */}
										<div className="text-sm">
											<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
												CCCD
											</p>
											<p className="text-gray-700 dark:text-gray-300">
												{partner.cccd || "—"}
											</p>
										</div>

										{/* Invoice Data mobile view */}
										{(partner as any).invoiceData && (
											<div className="text-sm">
												<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
													Thông tin xuất hóa đơn
												</p>
												<pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed border-l-2 border-emerald-200 dark:border-emerald-800 pl-2 py-0.5 mt-0.5">
													{(partner as any).invoiceData}
												</pre>
											</div>
										)}

										{/* DD Info */}
										{partner.ddInfo && (
											<div className="text-[11px] space-y-1 border-l-2 border-blue-100 dark:border-blue-900 pl-2 py-1">
												<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
													DD Info
												</p>
												<div className="flex gap-1">
													<span className="font-bold text-gray-400">SRV:</span>
													<span className="text-gray-900 dark:text-gray-100">
														{parseDDInfo(partner.ddInfo).dataSource}
													</span>
												</div>
												<div className="flex gap-1">
													<span className="font-bold text-gray-400">DB:</span>
													<span className="text-gray-900 dark:text-gray-100">
														{parseDDInfo(partner.ddInfo).catalog}
													</span>
												</div>
												<div className="flex gap-1">
													<span className="font-bold text-gray-400">UID:</span>
													<span className="text-gray-900 dark:text-gray-100">
														{parseDDInfo(partner.ddInfo).userId}
													</span>
												</div>
											</div>
										)}

										{/* Flags */}
										<div className="flex gap-3 flex-wrap text-sm">
											{partner.ewmsPass && (
												<div>
													<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
														EWMS Pass
													</p>
													<span className="font-mono text-xs text-gray-700 dark:text-gray-300">
														{partner.ewmsPass}
													</span>
												</div>
											)}
											{partner.maHQ && (
												<div>
													<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
														Mã HQ
													</p>
													<span className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">
														{partner.maHQ}
													</span>
												</div>
											)}
											{partner.vatType && (
												<div>
													<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
														VAT Type
													</p>
													<span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
														{partner.vatType}
													</span>
												</div>
											)}
										</div>

										{/* Credit-Only Fees mobile view */}
										{partner.creditOnlyFeeCodes?.length > 0 && (
											<div>
												<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
													Credit-Only Fees
												</p>
												<div className="flex flex-wrap gap-1">
													{partner.creditOnlyFeeCodes.map((code) => (
														<Badge
															key={code}
															className="bg-orange-100/60 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 pointer-events-none text-[10px] font-mono px-1.5 py-0.5 rounded"
														>
															{code}
														</Badge>
													))}
												</div>
											</div>
										)}

										{/* Toggle flags */}
										<div className="flex gap-3 text-sm">
											<div className="flex items-center gap-1.5">
												<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
													KVGS
												</p>
												{partner.enableKVGS ? (
													<div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600">
														<ShieldCheck className="size-3" />
													</div>
												) : (
													<div className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
														<X className="size-3" />
													</div>
												)}
											</div>
											<div className="flex items-center gap-1.5">
												<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
													CDS
												</p>
												{partner.enableCDS ? (
													<div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600">
														<Database className="size-3" />
													</div>
												) : (
													<div className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
														<X className="size-3" />
													</div>
												)}
											</div>
										</div>

										{/* Created By */}
										<div className="text-sm border-t border-gray-100 dark:border-gray-700 pt-2">
											<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
												Created By
											</p>
											<UserDisplay
												user={partner.user}
												size="sm"
												showEmail={true}
											/>
										</div>

										{/* Actions */}
										<div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
											<Button
												variant="ghost"
												size="icon"
												className="size-8 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
												onClick={() => startEdit(partner)}
												title="Edit"
											>
												<Pencil className="size-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="size-8 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
												onClick={() =>
													setDeleteConfirm({
														open: true,
														id: partner.id,
														taxCode: partner.taxCode || "N/A",
													})
												}
												title="Delete"
											>
												<Trash2 className="size-4" />
											</Button>
										</div>
									</div>
								)}
							</div>
						))
					) : (
						<div className="py-24 px-4">
							<div className="flex flex-col items-center justify-center opacity-40">
								<Users className="size-16 mb-4 text-gray-300" />
								<p className="text-lg font-bold">No partners found</p>
								<p className="text-sm">
									Try adjusting your filter or add a new partner
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Pagination Controls */}
				<div className="p-6 border-t border-gray-50 dark:border-gray-800 bg-gray-50/10 flex flex-col sm:flex-row items-center justify-between gap-4">
					<div className="text-xs font-medium text-muted-foreground">
						Showing{" "}
						<span className="text-foreground">
							{pagination.total === 0
								? 0
								: (currentPage - 1) * pagination.pageSize + 1}
						</span>{" "}
						to{" "}
						<span className="text-foreground">
							{Math.min(currentPage * pagination.pageSize, pagination.total)}
						</span>{" "}
						of <span className="text-foreground">{pagination.total}</span>{" "}
						partners
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							className="h-8 rounded-lg"
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={currentPage <= 1}
						>
							Previous
						</Button>
						<div className="flex items-center gap-1">
							{Array.from(
								{ length: Math.min(5, pagination.totalPages) },
								(_, i) => {
									let pageNum = currentPage;
									if (pagination.totalPages <= 5) pageNum = i + 1;
									else if (currentPage <= 3) pageNum = i + 1;
									else if (currentPage >= pagination.totalPages - 2)
										pageNum = pagination.totalPages - 4 + i;
									else pageNum = currentPage - 2 + i;

									return (
										<Button
											key={pageNum}
											variant={currentPage === pageNum ? "default" : "outline"}
											size="icon"
											className="size-8 rounded-lg text-xs"
											onClick={() => setPage(pageNum)}
										>
											{pageNum}
										</Button>
									);
								},
							)}
						</div>
						<Button
							variant="outline"
							size="sm"
							className="h-8 rounded-lg"
							onClick={() =>
								setPage((p) => Math.min(pagination.totalPages, p + 1))
							}
							disabled={currentPage >= pagination.totalPages}
						>
							Next
						</Button>
					</div>
				</div>
			</div>

			{/* Add Dialog */}
			<Dialog
				open={addDialogOpen}
				onOpenChange={(open) => {
					setAddDialogOpen(open);
					if (!open) setErpSuggestion({ loading: false, name: null });
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Add New Partner</DialogTitle>
						<DialogDescription>
							Enter partner information below.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">Tax Code (MST)</label>
							<Input
								value={addForm.taxCode}
								onChange={async (e) => {
									const val = e.target.value;
									setAddForm((f) => ({ ...f, taxCode: val }));
									setErpSuggestion({ loading: false, name: null });

									if (!val.trim() || val.trim().length < 5) return;

									// Debounce via setTimeout trick inside onChange
									const code = val.trim();
									setErpSuggestion({ loading: true, name: null });
									// Small delay handled by clearing on next change
									setTimeout(async () => {
										// If user kept typing, addForm.taxCode won't match — skip
										try {
											const res = await fetch(
												`/api/admin/partners-master-data/erp-lookup?taxCode=${encodeURIComponent(code)}`,
											);
											if (!res.ok) return;
											const data = await res.json();
											setErpSuggestion({
												loading: false,
												name: data.found ? data.fullName : null,
											});
										} catch {
											setErpSuggestion({ loading: false, name: null });
										}
									}, 800);
								}}
								placeholder="Enter tax code"
								className="rounded-xl"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Full Name</label>
							<div className="relative">
								<Input
									value={addForm.fullName}
									onChange={(e) =>
										setAddForm((f) => ({ ...f, fullName: e.target.value }))
									}
									placeholder="Full name (auto-filled from ERP)"
									className="rounded-xl pr-8"
								/>
								{erpSuggestion.loading && (
									<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
								)}
							</div>
							{/* ERP Suggestion banner */}
							{!erpSuggestion.loading &&
								erpSuggestion.name &&
								erpSuggestion.name !== addForm.fullName && (
									<div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl text-sm">
										<Sparkles className="size-3.5 text-purple-500 shrink-0" />
										<span className="text-purple-700 dark:text-purple-300 truncate flex-1">
											ERP: <strong>{erpSuggestion.name}</strong>
										</span>
										<button
											type="button"
											onClick={() =>
												setAddForm((f) => ({
													...f,
													fullName: erpSuggestion.name!,
												}))
											}
											className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 transition-colors shrink-0 underline underline-offset-2"
										>
											Dùng tên này
										</button>
									</div>
								)}
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">CCCD</label>
							<Input
								value={addForm.cccd}
								onChange={(e) =>
									setAddForm((f) => ({ ...f, cccd: e.target.value }))
								}
								placeholder="Enter CCCD"
								className="rounded-xl"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">
								DD Info (Connection String)
							</label>
							<div className="grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-xl border border-dashed">
								<div className="space-y-1">
									<label className="text-[10px] uppercase font-bold text-muted-foreground">
										Server/IP
									</label>
									<Input
										value={parseDDInfo(addForm.ddInfo).dataSource}
										onChange={(e) => {
											const current = parseDDInfo(addForm.ddInfo);
											setAddForm((f) => ({
												...f,
												ddInfo: composeDDInfo({
													...current,
													dataSource: e.target.value,
												}),
											}));
										}}
										placeholder="1.2.3.4"
										className="h-8 rounded-lg text-xs"
									/>
								</div>
								<div className="space-y-1">
									<label className="text-[10px] uppercase font-bold text-muted-foreground">
										Database
									</label>
									<Input
										value={parseDDInfo(addForm.ddInfo).catalog}
										onChange={(e) => {
											const current = parseDDInfo(addForm.ddInfo);
											setAddForm((f) => ({
												...f,
												ddInfo: composeDDInfo({
													...current,
													catalog: e.target.value,
												}),
											}));
										}}
										placeholder="ECUS_2025"
										className="h-8 rounded-lg text-xs"
									/>
								</div>
								<div className="space-y-1">
									<label className="text-[10px] uppercase font-bold text-muted-foreground">
										User ID
									</label>
									<Input
										value={parseDDInfo(addForm.ddInfo).userId}
										onChange={(e) => {
											const current = parseDDInfo(addForm.ddInfo);
											setAddForm((f) => ({
												...f,
												ddInfo: composeDDInfo({
													...current,
													userId: e.target.value,
												}),
											}));
										}}
										placeholder="sa"
										className="h-8 rounded-lg text-xs"
									/>
								</div>
								{isAdminOnly && (
									<div className="space-y-1">
										<label className="text-[10px] uppercase font-bold text-muted-foreground">
											Password
										</label>
										<div className="relative">
											<Input
												type={showAddPassword ? "text" : "password"}
												value={parseDDInfo(addForm.ddInfo).password}
												onChange={(e) => {
													const current = parseDDInfo(addForm.ddInfo);
													setAddForm((f) => ({
														...f,
														ddInfo: composeDDInfo({
															...current,
															password: e.target.value,
														}),
													}));
												}}
												placeholder="********"
												className="h-8 rounded-lg text-xs pr-10"
											/>
											<button
												type="button"
												onClick={() => setShowAddPassword(!showAddPassword)}
												className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
											>
												{showAddPassword ? (
													<EyeOff className="size-4" />
												) : (
													<Eye className="size-4" />
												)}
											</button>
										</div>
									</div>
								)}
							</div>
						</div>
						{/* Invoice Data Add dialog */}
						<div className="space-y-2">
							<label className="text-sm font-medium">
								Thông tin xuất hóa đơn
							</label>
							<textarea
								value={addForm.invoiceData}
								onChange={(e) =>
									setAddForm((f) => ({ ...f, invoiceData: e.target.value }))
								}
								rows={4}
								className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
								placeholder="Tên công ty đầy đủ, địa chỉ, MST..."
							/>
						</div>
						{/* EWMS Pass Add dialog */}
						<div className="space-y-2">
							<label className="text-sm font-medium">EWMS Pass</label>
							<Input
								value={addForm.ewmsPass}
								onChange={(e) =>
									setAddForm((f) => ({ ...f, ewmsPass: e.target.value }))
								}
								placeholder="EWMS password"
								className="rounded-xl"
							/>
						</div>
						{/* Mã HQ Add dialog */}
						<div className="space-y-2">
							<label className="text-sm font-medium">Mã HQ</label>
							<Input
								value={addForm.maHQ}
								onChange={(e) =>
									setAddForm((f) => ({ ...f, maHQ: e.target.value }))
								}
								placeholder="VD: 0301"
								className="rounded-xl"
							/>
						</div>
						{/* VAT Type Add dialog */}
						<div className="space-y-2">
							<label className="text-sm font-medium">VAT Type</label>
							<Select
								value={addForm.vatType}
								onValueChange={(val) =>
									setAddForm((f) => ({ ...f, vatType: val as string }))
								}
							>
								<SelectTrigger className="rounded-xl">
									<SelectValue placeholder="Chọn loại VAT" />
								</SelectTrigger>
								<SelectPositioner className="z-[110]">
									<SelectContent className="rounded-xl">
										<SelectItem value="SAU VAT CÓ VAT">
											SAU VAT CÓ VAT
										</SelectItem>
										<SelectItem value="TRƯỚC VAT CÓ VAT">
											TRƯỚC VAT CÓ VAT
										</SelectItem>
										<SelectItem value="TRƯỚC VAT KHÔNG VAT">
											TRƯỚC VAT KHÔNG VAT
										</SelectItem>
										<SelectItem value="SAU VAT KHÔNG VAT">
											SAU VAT KHÔNG VAT
										</SelectItem>
									</SelectContent>
								</SelectPositioner>
							</Select>
						</div>
						{/* Credit-Only Fee Codes Add dialog */}
						{vendorFeeTypeOptions.length > 0 && (
							<div className="space-y-2">
								<label className="text-sm font-medium">
									Credit-Only Fees
									<span className="ml-1 text-xs text-muted-foreground font-normal">
										(các phí chỉ OTHERCREDIT, không OTHERDEBIT)
									</span>
								</label>
								<div className="space-y-1.5 p-3 rounded-xl bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900/30">
									{vendorFeeTypeOptions.map((ft) => (
										<label
											key={ft.id}
											className="flex items-center gap-2.5 cursor-pointer group"
										>
											<Checkbox
												checked={addForm.creditOnlyFeeCodes.includes(
													ft.feeCode,
												)}
												onCheckedChange={(checked) =>
													setAddForm((f) => ({
														...f,
														creditOnlyFeeCodes: checked
															? [...f.creditOnlyFeeCodes, ft.feeCode]
															: f.creditOnlyFeeCodes.filter(
																	(c) => c !== ft.feeCode,
																),
													}))
												}
												className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
											/>
											<span className="text-sm font-mono text-orange-700 dark:text-orange-300 group-hover:text-orange-800 transition-colors">
												{ft.feeCode}
											</span>
											<span className="text-xs text-muted-foreground">
												{ft.name}
											</span>
										</label>
									))}
								</div>
							</div>
						)}
						{canEditAllSites && (
							<div className="space-y-2">
								<label className="text-sm font-medium">Site</label>
								<Select
									value={addForm.site}
									onValueChange={(val) =>
										setAddForm((f) => ({ ...f, site: val as Site }))
									}
								>
									<SelectTrigger className="rounded-xl">
										<SelectValue />
									</SelectTrigger>
									<SelectPositioner className="z-[110]">
										<SelectContent className="rounded-xl">
											<SelectItem value="SGN">SGN</SelectItem>
											<SelectItem value="HAN">HAN</SelectItem>
											<SelectItem value="DAD">DAD</SelectItem>
										</SelectContent>
									</SelectPositioner>
								</Select>
							</div>
						)}
						<div className="flex flex-col sm:flex-row gap-4 sm:gap-8 py-3 border-t border-dashed mt-2">
							<div className="flex items-center space-x-2 cursor-pointer group">
								<Checkbox
									id="add-kvgs"
									className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
									checked={addForm.enableKVGS}
									onCheckedChange={(checked) =>
										setAddForm((f) => ({ ...f, enableKVGS: !!checked }))
									}
								/>
								<label
									htmlFor="add-kvgs"
									className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer group-hover:text-purple-600 transition-colors"
								>
									Enable KVGS Automation
								</label>
							</div>
							<div className="flex items-center space-x-2 cursor-pointer group">
								<Checkbox
									id="add-cds"
									className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
									checked={addForm.enableCDS}
									onCheckedChange={(checked) =>
										setAddForm((f) => ({ ...f, enableCDS: !!checked }))
									}
								/>
								<label
									htmlFor="add-cds"
									className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer group-hover:text-blue-600 transition-colors"
								>
									Enable CDS Tracking
								</label>
							</div>
						</div>
					</div>
					<DialogFooter className="gap-3">
						<Button
							variant="outline"
							className="rounded-xl"
							onClick={() => setAddDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							className="rounded-xl bg-purple-600 hover:bg-purple-700"
							onClick={() => createMutation.mutate(addForm)}
							disabled={createMutation.isPending}
						>
							{createMutation.isPending && <Spinner className="mr-2 size-4" />}
							<Plus className="mr-2 size-4" />
							Add Partner
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={deleteConfirm.open}
				onOpenChange={(val) =>
					setDeleteConfirm((prev) => ({ ...prev, open: val }))
				}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
							<AlertTriangle className="size-6 text-red-600 dark:text-red-400" />
						</div>
						<DialogTitle className="text-center">Confirm Deletion</DialogTitle>
						<DialogDescription className="text-center">
							Are you sure you want to delete partner with Tax Code{" "}
							<span className="font-semibold text-foreground">
								{deleteConfirm.taxCode}
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
								setDeleteConfirm({ open: false, id: "", taxCode: "" })
							}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							className="rounded-xl"
							onClick={() => deleteMutation.mutate(deleteConfirm.id)}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending && <Spinner className="mr-2 size-4" />}
							<Trash2 className="mr-2 size-4" />
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
