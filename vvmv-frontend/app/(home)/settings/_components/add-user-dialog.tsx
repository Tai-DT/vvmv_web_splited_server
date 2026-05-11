"use client";

import { Eye, EyeOff, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
import { USER_ROLE_OPTIONS } from "@/lib/constants/roles";

interface AddUserDialogProps {
	onUserCreated: () => void;
}

type ErpAccountsResponse = {
	accounts: string[];
	site: string;
};
export function AddUserDialog({ onUserCreated }: AddUserDialogProps) {
	const { data: session } = useSession();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [formLoading, setFormLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [erpAccounts, setErpAccounts] = useState<string[]>([]);
	const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
	const [suggestedAccount, setSuggestedAccount] = useState<string>("");
	const [formData, setFormData] = useState({
		name: "",
		username: "",
		email: "",
		password: "",
		role: "STAFF" as const,
		site: "" as "SGN" | "HAN" | "DAD" | "",
		erpAccount: "",
	});

	// Fetch ERP accounts when site changes or dialog opens
	useEffect(() => {
		const fetchErpAccounts = async () => {
			if (!isDialogOpen || !formData.site) {
				setErpAccounts([]);
				setSuggestedAccount("");
				return;
			}

			setIsLoadingAccounts(true);
			setSuggestedAccount("");

			try {
				const response = await fetch(
					`/api/user/erp-accounts?site=${formData.site}`,
				);

				if (!response.ok) {
					const data = await response.json();
					throw new Error(data.message || "Failed to fetch ERP accounts");
				}

				const data: ErpAccountsResponse = await response.json();
				setErpAccounts(data.accounts);

				// Auto-suggest account based on email
				if (data.accounts.length > 0 && formData.email) {
					const userEmail = formData.email.toLowerCase();
					const emailUsername = userEmail.split("@")[0];

					// Try exact match
					const exactMatch = data.accounts.find(
						(account) => account.toLowerCase() === emailUsername,
					);

					if (exactMatch) {
						setSuggestedAccount(exactMatch);
						setFormData((prev) => ({ ...prev, erpAccount: exactMatch }));
					}
				}
			} catch (err) {
				console.error("Failed to fetch ERP accounts:", err);
				setErpAccounts([]);
			} finally {
				setIsLoadingAccounts(false);
			}
		};

		fetchErpAccounts();
	}, [formData.site, formData.email, isDialogOpen]);

	// Initialize site for managers when dialog opens
	const handleDialogOpenChange = (open: boolean) => {
		setIsDialogOpen(open);
		if (open) {
			// Reset form
			setFormData({
				name: "",
				username: "",
				email: "",
				password: "",
				role: "STAFF",
				site: "",
				erpAccount: "",
			});
			setErpAccounts([]);
			setSuggestedAccount("");
			setShowPassword(false);

			// Auto-set site for managers
			if (session?.user?.role === "MANAGER" && (session.user as any).site) {
				const managerSite = (session.user as any).site as "SGN" | "HAN" | "DAD";
				setFormData((prev) => ({
					...prev,
					site: managerSite,
				}));
			}
		}
	};

	// Update suggested account when email changes
	useEffect(() => {
		if (formData.email && formData.site && erpAccounts.length > 0) {
			const userEmail = formData.email.toLowerCase();
			const emailUsername = userEmail.split("@")[0];

			// Try exact match
			const exactMatch = erpAccounts.find(
				(account) => account.toLowerCase() === emailUsername,
			);

			if (exactMatch && !formData.erpAccount) {
				setSuggestedAccount(exactMatch);
			}
		}
	}, [formData.email, formData.site, erpAccounts, formData.erpAccount]);

	const handleCreateUser = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormLoading(true);

		try {
			const response = await fetch("/api/admin/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || "Failed to create user");
			}

			toast.success("User created successfully", {
				description: `${formData.email} has been created with role ${formData.role}`,
			});

			setIsDialogOpen(false);
			onUserCreated();
		} catch (error) {
			toast.error("Failed to create user", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setFormLoading(false);
		}
	};

	const handleSiteChange = (value: "SGN" | "HAN" | "DAD" | "") => {
		setFormData((prev) => ({
			...prev,
			site: value,
			erpAccount: "", // Clear ERP account when site changes
		}));
	};

	const _handleEmailChange = (email: string) => {
		setFormData((prev) => ({ ...prev, email }));

		// Auto-suggest username from email if username is empty
		if (!formData.username && email) {
			const username = email.split("@")[0];
			setFormData((prev) => ({ ...prev, username }));
		}
	};

	return (
		<Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
			<DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
				<Plus className="h-4 w-4" /> Add User
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create New User</DialogTitle>
					<DialogDescription>
						Add a new user to the system. All fields are required.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleCreateUser} className="space-y-4 mt-4">
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
							<label className="block text-sm font-medium mb-2">Email *</label>
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
							<label className="block text-sm font-medium mb-2">
								Password *
							</label>
							<div className="relative">
								<Input
									type={showPassword ? "text" : "password"}
									value={formData.password}
									onChange={(e) =>
										setFormData({ ...formData, password: e.target.value })
									}
									placeholder="Min 6 characters"
									minLength={6}
									required
									className="pr-10"
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
								>
									{showPassword ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
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
							{session?.user?.role === "MANAGER" ? (
								<div className="px-3 py-2 rounded-md border border-input bg-muted text-sm">
									{formData.site || (session.user as any).site}
								</div>
							) : (
								<Select
									value={formData.site}
									onValueChange={(value: any) => handleSiteChange(value)}
									disabled={formLoading}
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
							)}
						</div>
						<div>
							<label className="block text-sm font-medium mb-2">
								ERP Account (Optional)
							</label>
							<Select
								value={formData.erpAccount}
								onValueChange={(value: any) =>
									setFormData({ ...formData, erpAccount: value })
								}
								disabled={formLoading || isLoadingAccounts || !formData.site}
							>
								<SelectTrigger className="w-full">
									<SelectValue
										placeholder={
											isLoadingAccounts
												? "Loading accounts..."
												: !formData.site
													? "Select site first"
													: "Select ERP Account"
										}
									/>
								</SelectTrigger>
								<SelectPositioner>
									<SelectContent>
										<SelectItem value="">None</SelectItem>
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
										{erpAccounts.length === 0 &&
											!isLoadingAccounts &&
											formData.site && (
												<div className="px-2 py-1.5 text-sm text-muted-foreground">
													No accounts found for this site
												</div>
											)}
									</SelectContent>
								</SelectPositioner>
							</Select>
							{suggestedAccount && formData.erpAccount !== suggestedAccount && (
								<p className="text-xs text-muted-foreground mt-1">
									Suggested account: {suggestedAccount}
								</p>
							)}
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
							{formLoading ? "Creating..." : "Create User"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
