"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Check,
	ChevronsUpDown,
	Clock,
	Copy,
	Eye,
	EyeOff,
	Key,
	Plus,
	Power,
	PowerOff,
	Search,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
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
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
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
import { useSiteUsers } from "@/hooks/use-site-users";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type Site = "SGN" | "HAN" | "DAD";

interface ApiKeyData {
	id: string;
	name: string;
	keyPrefix: string;
	site: Site;
	permissions: string[];
	isActive: boolean;
	expiresAt: string | null;
	lastUsedAt: string | null;
	createdAt: string;
	user: {
		id: string;
		name: string | null;
		email: string;
	} | null;
}

interface UserOption {
	id: string;
	name: string | null;
	email: string;
	site: Site | null;
}

const SITE_COLORS: Record<Site, string> = {
	SGN: "bg-gradient-to-r from-red-500 to-orange-500 text-white",
	HAN: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
	DAD: "bg-gradient-to-r from-teal-500 to-cyan-500 text-white",
};

const _PERMISSION_OPTIONS = [
	{ value: "create-transaction", label: "Create Transaction" },
];

export function ApiKeysManagement() {
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	const userSite = (session?.user as any)?.site as Site | undefined;

	const [page, setPage] = useState(1);
	const [searchFilter, setSearchFilter] = useState("");

	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [addForm, setAddForm] = useState({
		name: "",
		userId: "",
		site: (userSite || "SGN") as Site,
		permissions: ["create-transaction"],
		expiresAt: "",
	});

	const [newKeyData, setNewKeyData] = useState<{
		key: string;
		name: string;
	} | null>(null);
	const [showNewKey, setShowNewKey] = useState(false);

	const [deleteConfirm, setDeleteConfirm] = useState<{
		open: boolean;
		id: string;
		name: string;
	}>({ open: false, id: "", name: "" });

	// Fetch API keys
	const {
		data: apiData,
		isLoading,
		error: loadError,
		isFetching,
	} = useQuery({
		queryKey: ["api-keys", page],
		queryFn: async () => {
			const params = new URLSearchParams({
				page: page.toString(),
				pageSize: "10",
			});
			const res = await fetch(`/api/admin/api-keys?${params}`);
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Failed to fetch API keys");
			}
			return res.json();
		},
	});

	// Use site users hook for the combobox
	const { users: siteUsers, isLoading: usersLoading } = useSiteUsers();
	const [userComboboxOpen, setUserComboboxOpen] = useState(false);

	const selectedUser = useMemo(() => {
		return siteUsers.find((u) => u.id === addForm.userId);
	}, [siteUsers, addForm.userId]);

	// Create mutation
	const createMutation = useMutation({
		mutationFn: async (data: {
			name: string;
			userId: string;
			site: Site;
			permissions: string[];
			expiresAt: string | null;
		}) => {
			const res = await fetch("/api/admin/api-keys", {
				method: "POST",
				body: JSON.stringify(data),
				headers: { "Content-Type": "application/json" },
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Create failed");
			}
			return res.json();
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["api-keys"] });
			toast.success("API key created successfully!");
			// Store the new key to display
			setNewKeyData({
				key: data.apiKey.key,
				name: data.apiKey.name,
			});
			setAddDialogOpen(false);
			setAddForm({
				name: "",
				userId: "",
				site: userSite || "SGN",
				permissions: ["create-transaction"],
				expiresAt: "",
			});
		},
		onError: (err: any) => {
			toast.error(err.message || "Failed to create API key");
		},
	});

	// Toggle active mutation
	const toggleActiveMutation = useMutation({
		mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
			const res = await fetch("/api/admin/api-keys", {
				method: "PUT",
				body: JSON.stringify({ id, isActive }),
				headers: { "Content-Type": "application/json" },
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Update failed");
			}
			return res.json();
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["api-keys"] });
			toast.success(
				variables.isActive ? "API key activated" : "API key revoked",
			);
		},
		onError: (err: any) => {
			toast.error(err.message || "Failed to update API key");
		},
	});

	// Delete mutation
	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/admin/api-keys?id=${id}`, {
				method: "DELETE",
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Delete failed");
			}
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["api-keys"] });
			toast.success("API key deleted");
			setDeleteConfirm({ open: false, id: "", name: "" });
		},
		onError: (err: any) => {
			toast.error(err.message || "Failed to delete API key");
		},
	});

	const apiKeys = apiData?.apiKeys || [];
	const pagination = apiData?.pagination || { total: 0, totalPages: 1 };

	const filteredKeys = searchFilter
		? apiKeys.filter(
				(key: ApiKeyData) =>
					key.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
					key.keyPrefix.toLowerCase().includes(searchFilter.toLowerCase()),
			)
		: apiKeys;

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast.success("Copied to clipboard!");
	};

	const formatDate = (dateStr: string | null) => {
		if (!dateStr) return "—";
		return new Date(dateStr).toLocaleDateString("vi-VN", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
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
				<p className="font-bold">Error loading data:</p>
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
						<div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-1">
							<Key className="size-5" />
							<span className="text-xs font-black uppercase tracking-[0.2em]">
								External Access
							</span>
						</div>
						<h2 className="text-4xl font-black tracking-tighter text-gray-900 dark:text-white">
							API Keys Management
						</h2>
						<p className="text-muted-foreground leading-relaxed text-sm md:text-base">
							Manage API keys for external integrations like UiPath. Each key
							can be scoped to specific sites and permissions.
						</p>
					</div>

					<Button
						onClick={() => setAddDialogOpen(true)}
						className="h-10 px-8 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-amber-500/20 bg-amber-600 hover:bg-amber-700 text-white"
					>
						<Plus className="mr-2 size-4" />
						Create API Key
					</Button>
				</div>
			</div>

			{/* New Key Display (shown once after creation) */}
			{newKeyData && (
				<div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-2xl p-6 animate-in fade-in slide-in-from-top-2">
					<div className="flex items-start gap-4">
						<div className="p-3 bg-green-500 rounded-xl text-white">
							<Key className="size-6" />
						</div>
						<div className="flex-1 space-y-3">
							<div>
								<h3 className="text-lg font-bold text-green-700 dark:text-green-400">
									API Key Created Successfully!
								</h3>
								<p className="text-sm text-green-600 dark:text-green-500">
									<strong>Important:</strong> Copy this key now. It won&apos;t
									be shown again!
								</p>
							</div>

							<div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-green-200 dark:border-green-800">
								<p className="text-xs font-medium text-gray-500 mb-2">
									{newKeyData.name}
								</p>
								<div className="flex items-center gap-3">
									<code className="flex-1 font-mono text-sm bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded-lg overflow-x-auto">
										{showNewKey ? newKeyData.key : "•".repeat(40)}
									</code>
									<button
										onClick={() => setShowNewKey(!showNewKey)}
										className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
									>
										{showNewKey ? (
											<EyeOff className="size-4" />
										) : (
											<Eye className="size-4" />
										)}
									</button>
									<Button
										size="sm"
										variant="outline"
										onClick={() => copyToClipboard(newKeyData.key)}
										className="shrink-0"
									>
										<Copy className="size-4 mr-1" />
										Copy
									</Button>
								</div>
							</div>

							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setNewKeyData(null);
									setShowNewKey(false);
								}}
								className="text-green-600 hover:text-green-700 hover:bg-green-100"
							>
								<Check className="size-4 mr-1" />
								I&apos;ve saved the key
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Table */}
			<div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
				<div className="p-6 border-b border-gray-50 dark:border-gray-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/30 dark:bg-gray-900/10">
					<div className="flex items-center gap-4">
						<div className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
							<Key className="size-5 text-gray-600 dark:text-gray-400" />
						</div>
						<div>
							<h3 className="text-lg font-bold text-gray-900 dark:text-white">
								API Keys
							</h3>
							<p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
								{pagination.total} keys
							</p>
						</div>
					</div>

					<div className="relative w-full md:w-64">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<Input
							placeholder="Search keys..."
							value={searchFilter}
							onChange={(e) => setSearchFilter(e.target.value)}
							className="h-10 pl-10 rounded-xl border-gray-100 dark:border-gray-700 bg-white/50 backdrop-blur-sm"
						/>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-left border-collapse min-w-[900px]">
						<thead>
							<tr className="bg-gray-50/50 dark:bg-gray-900/20">
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Name / Key
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Site
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Status
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									User
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Last Used
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
									Expires
								</th>
								<th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-50 dark:divide-gray-800">
							{filteredKeys.length > 0 ? (
								filteredKeys.map((apiKey: ApiKeyData) => (
									<tr
										key={apiKey.id}
										className="group hover:bg-gray-50/30 dark:hover:bg-gray-900/10 transition-colors"
									>
										<td className="px-6 py-4">
											<div>
												<p className="font-semibold text-gray-900 dark:text-white">
													{apiKey.name}
												</p>
												<div className="flex items-center gap-2 mt-1">
													<code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
														{apiKey.keyPrefix}...
													</code>
													<span className="text-xs text-muted-foreground">
														{apiKey.permissions.join(", ")}
													</span>
												</div>
											</div>
										</td>
										<td className="px-6 py-4">
											<Badge
												className={`${SITE_COLORS[apiKey.site]} text-xs font-bold px-3 py-1 rounded-lg`}
											>
												{apiKey.site}
											</Badge>
										</td>
										<td className="px-6 py-4">
											{apiKey.isActive ? (
												<Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-semibold">
													<Power className="size-3 mr-1" />
													Active
												</Badge>
											) : (
												<Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold">
													<PowerOff className="size-3 mr-1" />
													Revoked
												</Badge>
											)}
										</td>
										<td className="px-6 py-4">
											<UserDisplay
												user={apiKey.user}
												size="sm"
												showEmail={false}
											/>
										</td>
										<td className="px-6 py-4">
											<div className="flex items-center gap-1 text-sm text-muted-foreground">
												<Clock className="size-3" />
												{formatDate(apiKey.lastUsedAt)}
											</div>
										</td>
										<td className="px-6 py-4">
											<span className="text-sm text-muted-foreground">
												{apiKey.expiresAt
													? formatDate(apiKey.expiresAt)
													: "Never"}
											</span>
										</td>
										<td className="px-6 py-4 text-right">
											<div className="flex justify-end gap-2">
												<Button
													variant="ghost"
													size="icon"
													className={`size-8 rounded-lg ${
														apiKey.isActive
															? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
															: "text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
													}`}
													onClick={() =>
														toggleActiveMutation.mutate({
															id: apiKey.id,
															isActive: !apiKey.isActive,
														})
													}
													disabled={toggleActiveMutation.isPending}
													title={apiKey.isActive ? "Revoke" : "Activate"}
												>
													{apiKey.isActive ? (
														<PowerOff className="size-4" />
													) : (
														<Power className="size-4" />
													)}
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="size-8 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
													onClick={() =>
														setDeleteConfirm({
															open: true,
															id: apiKey.id,
															name: apiKey.name,
														})
													}
												>
													<Trash2 className="size-4" />
												</Button>
											</div>
										</td>
									</tr>
								))
							) : (
								<tr>
									<td
										colSpan={7}
										className="px-6 py-12 text-center text-muted-foreground"
									>
										<Key className="size-12 mx-auto mb-4 opacity-20" />
										<p className="font-medium">No API keys found</p>
										<p className="text-sm">
											Create your first API key to get started
										</p>
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				{/* Pagination */}
				{pagination.totalPages > 1 && (
					<div className="p-4 border-t border-gray-50 dark:border-gray-800 flex justify-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page === 1}
						>
							Previous
						</Button>
						<span className="px-4 py-2 text-sm text-muted-foreground">
							Page {page} of {pagination.totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								setPage((p) => Math.min(pagination.totalPages, p + 1))
							}
							disabled={page === pagination.totalPages}
						>
							Next
						</Button>
					</div>
				)}
			</div>

			{/* Create Dialog */}
			<Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Key className="size-5 text-amber-500" />
							Create API Key
						</DialogTitle>
						<DialogDescription>
							Create a new API key for external integrations. The key will only
							be shown once.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						{/* Name */}
						<div className="space-y-2">
							<label className="text-sm font-medium">Name</label>
							<Input
								placeholder="e.g., UiPath Production"
								value={addForm.name}
								onChange={(e) =>
									setAddForm((f) => ({ ...f, name: e.target.value }))
								}
							/>
						</div>

						{/* User */}
						<div className="space-y-2">
							<label className="text-sm font-medium">Associated User</label>
							<Popover
								open={userComboboxOpen}
								onOpenChange={setUserComboboxOpen}
							>
								<PopoverTrigger
									render={
										<Button
											variant="outline"
											role="combobox"
											aria-expanded={userComboboxOpen}
											className="w-full justify-between h-10 px-3 font-normal"
										/>
									}
								>
									{selectedUser ? (
										<UserDisplay
											user={selectedUser}
											size="sm"
											showEmail={true}
											className="flex-1"
										/>
									) : (
										<span className="text-muted-foreground">
											{usersLoading ? "Loading..." : "Select a user..."}
										</span>
									)}
									<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</PopoverTrigger>
								<PopoverPositioner className="z-[200]">
									<PopoverContent className="w-[350px] p-0">
										<Command>
											<CommandInput
												placeholder="Search user..."
												className="h-9"
											/>
											<CommandList>
												<CommandEmpty>
													{usersLoading
														? "Loading users..."
														: "No users found."}
												</CommandEmpty>
												<CommandGroup>
													{siteUsers.map((user) => (
														<CommandItem
															key={user.id}
															value={`${user.email} ${user.name || ""} ${user.username || ""} ${user.id}`}
															onSelect={() => {
																setAddForm((f) => ({ ...f, userId: user.id }));
																setUserComboboxOpen(false);
															}}
															className="flex items-center justify-between"
														>
															<UserDisplay
																user={user}
																size="sm"
																showEmail={true}
																className="flex-1"
															/>
															<Check
																className={cn(
																	"ml-auto h-4 w-4",
																	addForm.userId === user.id
																		? "opacity-100"
																		: "opacity-0",
																)}
															/>
														</CommandItem>
													))}
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</PopoverPositioner>
							</Popover>
							<p className="text-xs text-muted-foreground">
								This user&apos;s ERP account will be used for transactions
							</p>
						</div>

						{/* Site */}
						<div className="space-y-2">
							<label className="text-sm font-medium">Site</label>
							<Select
								value={addForm.site}
								onValueChange={(val) =>
									setAddForm((f) => ({ ...f, site: val as Site }))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectPositioner className="z-[110]">
									<SelectContent>
										{isSuperAdmin ? (
											<>
												<SelectItem value="SGN">SGN</SelectItem>
												<SelectItem value="HAN">HAN</SelectItem>
												<SelectItem value="DAD">DAD</SelectItem>
											</>
										) : (
											<SelectItem value={userSite || "SGN"}>
												{userSite || "SGN"}
											</SelectItem>
										)}
									</SelectContent>
								</SelectPositioner>
							</Select>
						</div>

						{/* Expiration (optional) */}
						<div className="space-y-2">
							<label className="text-sm font-medium">
								Expiration (optional)
							</label>
							<Input
								type="datetime-local"
								value={addForm.expiresAt}
								onChange={(e) =>
									setAddForm((f) => ({ ...f, expiresAt: e.target.value }))
								}
							/>
							<p className="text-xs text-muted-foreground">
								Leave empty for no expiration
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setAddDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={() =>
								createMutation.mutate({
									name: addForm.name,
									userId: addForm.userId,
									site: addForm.site,
									permissions: addForm.permissions,
									expiresAt: addForm.expiresAt || null,
								})
							}
							disabled={
								!addForm.name || !addForm.userId || createMutation.isPending
							}
							className="bg-amber-600 hover:bg-amber-700"
						>
							{createMutation.isPending ? (
								<Spinner className="size-4 mr-2" />
							) : (
								<Key className="size-4 mr-2" />
							)}
							Create Key
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={deleteConfirm.open}
				onOpenChange={(open) => setDeleteConfirm((d) => ({ ...d, open }))}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-red-600">
							<AlertTriangle className="size-5" />
							Delete API Key
						</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete &quot;{deleteConfirm.name}&quot;?
							This action cannot be undone. Any integrations using this key will
							stop working.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() =>
								setDeleteConfirm({ open: false, id: "", name: "" })
							}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => deleteMutation.mutate(deleteConfirm.id)}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending ? (
								<Spinner className="size-4 mr-2" />
							) : (
								<Trash2 className="size-4 mr-2" />
							)}
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
