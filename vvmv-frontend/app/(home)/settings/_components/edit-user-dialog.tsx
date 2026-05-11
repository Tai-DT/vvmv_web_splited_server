"use client";

import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { USER_ROLE_OPTIONS } from "@/lib/constants/roles";

interface User {
	id: string;
	name: string;
	email: string;
	username: string;
	role: string;
	site: string | null;
	erpAccount: string | null;
}

interface EditUserDialogProps {
	user: User;
	onUserUpdated: () => void;
}
type ErpAccountsResponse = {
	accounts: string[];
	site: string;
};

export function EditUserDialog({ user, onUserUpdated }: EditUserDialogProps) {
	const [selectedSite, setSelectedSite] = useState<string>("");
	const [erpAccounts, setErpAccounts] = useState<string[]>([]);
	const [_selectedErpAccount, _setSelectedErpAccount] = useState<string>("");
	const [suggestedAccount, setSuggestedAccount] = useState<string>("");
	const [_isLoadingAccounts, setIsLoadingAccounts] = useState(false);
	const [_accountsError, setAccountsError] = useState<string>("");
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [formLoading, setFormLoading] = useState(false);
	const [formData, setFormData] = useState({
		name: user.name,
		username: user.username,
		email: user.email,
		role: user.role,
		site: user.site || "",
		erpAccount: user.erpAccount || "",
	});

	// Reset form data when dialog opens or user changes
	// Fetch ERP accounts when dialog opens or site changes
	useEffect(() => {
		const fetchErpAccounts = async () => {
			if (!isDialogOpen) return;

			const siteToFetch = selectedSite || user.site;
			if (!siteToFetch) {
				setErpAccounts([]);
				return;
			}

			setIsLoadingAccounts(true);
			setAccountsError("");
			setSuggestedAccount("");

			try {
				const response = await fetch(
					`/api/user/erp-accounts?site=${siteToFetch}`,
				);

				if (!response.ok) {
					const data = await response.json();
					throw new Error(data.message || "Failed to fetch ERP accounts");
				}

				const data: ErpAccountsResponse = await response.json();
				setErpAccounts(data.accounts);

				// Auto-match logic
				if (data.accounts.length > 0 && user?.email) {
					const userEmail = user.email.toLowerCase();
					const emailUsername = userEmail.split("@")[0];

					// Try exact match
					const exactMatch = data.accounts.find(
						(account) => account.toLowerCase() === emailUsername,
					);

					if (exactMatch) {
						setSuggestedAccount(exactMatch);
						setFormData((prev) => ({ ...prev, erpAccount: exactMatch }));
					} else {
						// Try partial match
						const partialMatch = data.accounts.find((account) =>
							account.toLowerCase().includes(emailUsername),
						);

						if (partialMatch) {
							setSuggestedAccount(partialMatch);
							// Don't auto-set partial matches, just suggest them
						}
					}
				}
			} catch (err) {
				setAccountsError(
					err instanceof Error ? err.message : "An error occurred",
				);
				setErpAccounts([]);
				toast.error("Failed to load ERP accounts", {
					description: err instanceof Error ? err.message : "Unknown error",
				});
			} finally {
				setIsLoadingAccounts(false);
			}
		};

		fetchErpAccounts();
	}, [isDialogOpen, user, selectedSite]);

	// Reset form when dialog opens or user changes
	useEffect(() => {
		if (isDialogOpen) {
			setFormData({
				name: user.name,
				username: user.username,
				email: user.email,
				role: user.role,
				site: user.site || "",
				erpAccount: user.erpAccount || "",
			});
			setSelectedSite(user.site || "");
			setSuggestedAccount("");
		}
	}, [isDialogOpen, user]);

	const handleUpdateUser = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormLoading(true);

		try {
			const response = await fetch("/api/admin/users", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: user.id,
					...formData,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || "Failed to update user");
			}

			toast.success("User updated successfully", {
				description: `${formData.email} has been updated`,
			});

			setIsDialogOpen(false);
			onUserUpdated();
		} catch (error) {
			toast.error("Failed to update user", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setFormLoading(false);
		}
	};

	return (
		<>
			<Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(true)}>
				<Pencil className="h-4 w-4" />
			</Button>
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit User</DialogTitle>
						<DialogDescription>
							Update user information. All fields are required except site.
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleUpdateUser} className="space-y-4 mt-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium mb-2">Name *</label>
								<Input
									type="text"
									value={formData.name}
									onChange={(e) =>
										setFormData({ ...formData, name: e.target.value })
									}
									placeholder="John Doe"
									required
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									Username *
								</label>
								<Input
									type="text"
									value={formData.username}
									onChange={(e) =>
										setFormData({ ...formData, username: e.target.value })
									}
									placeholder="johndoe"
									required
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									Email *
								</label>
								<Input
									type="email"
									value={formData.email}
									onChange={(e) =>
										setFormData({ ...formData, email: e.target.value })
									}
									placeholder="user@vvmv.com.vn"
									required
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Role *</label>
								<Select
									value={formData.role}
									onValueChange={(value: any) =>
										setFormData({ ...formData, role: value })
									}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectPositioner>
										<SelectContent>
											{USER_ROLE_OPTIONS.map((role) => (
												<SelectItem key={role.value} value={role.value}>
													{role.label}
												</SelectItem>
											))}
										</SelectContent>
									</SelectPositioner>
								</Select>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									Site (Optional)
								</label>
								<Select
									value={formData.site}
									onValueChange={(value: any) => {
										setFormData({ ...formData, site: value, erpAccount: "" });
										setSelectedSite(value);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select site" />
									</SelectTrigger>
									<SelectPositioner>
										<SelectContent>
											<SelectItem value="">None</SelectItem>
											<SelectItem value="SGN">Ho Chi Minh (SGN)</SelectItem>
											<SelectItem value="HAN">Ha Noi (HAN)</SelectItem>
											<SelectItem value="DAD">Da Nang (DAD)</SelectItem>
										</SelectContent>
									</SelectPositioner>
								</Select>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									ERP Account (Optional)
								</label>
								<Select
									value={formData.erpAccount}
									onValueChange={(value: any) => {
										setFormData({ ...formData, erpAccount: value });
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select ERP Account" />
									</SelectTrigger>
									<SelectPositioner>
										<SelectContent>
											{erpAccounts.map((account) => (
												<SelectItem key={account} value={account}>
													<span className="flex items-center gap-2">
														{account}
														{account === suggestedAccount && (
															<span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
																Suggested
															</span>
														)}
													</span>
												</SelectItem>
											))}
										</SelectContent>
									</SelectPositioner>
								</Select>
							</div>
						</div>

						<div className="flex justify-end gap-3 pt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsDialogOpen(false)}
								disabled={formLoading}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={formLoading}>
								{formLoading ? "Updating..." : "Update User"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
