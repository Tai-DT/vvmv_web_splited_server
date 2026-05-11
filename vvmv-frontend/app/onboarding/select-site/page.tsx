"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/lib/auth-client";

const SITES = [
	{ id: "SGN", label: "Ho Chi Minh (SGN)" },
	{ id: "DAD", label: "Da Nang (DAD)" },
	{ id: "HAN", label: "Ha Noi (HAN)" },
];

type ErpAccountsResponse = {
	accounts: string[];
	site: string;
};

export default function SelectSitePage() {
	const { data: session, isPending } = useSession();
	const router = useRouter();

	// Site selection state
	const [selectedSite, setSelectedSite] = useState<string>("");

	// ERP account state
	const [erpAccounts, setErpAccounts] = useState<string[]>([]);
	const [selectedErpAccount, setSelectedErpAccount] = useState<string>("");
	const [suggestedAccount, setSuggestedAccount] = useState<string>("");
	const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
	const [accountsError, setAccountsError] = useState<string>("");

	// Submission state
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string>("");

	// Redirect if not logged in or already has site
	useEffect(() => {
		if (!isPending && !session?.user) {
			router.push("/");
		}
	}, [isPending, session?.user, router]);

	// Fetch ERP accounts when site is selected
	useEffect(() => {
		if (!selectedSite) {
			setErpAccounts([]);
			setSelectedErpAccount("");
			setSuggestedAccount("");
			return;
		}

		const fetchErpAccounts = async () => {
			setIsLoadingAccounts(true);
			setAccountsError("");

			try {
				const response = await fetch(
					`/api/user/erp-accounts?site=${selectedSite}`,
				);

				if (!response.ok) {
					const data = await response.json();
					throw new Error(data.message || "Failed to fetch ERP accounts");
				}

				const data: ErpAccountsResponse = await response.json();
				setErpAccounts(data.accounts);

				// Auto-match logic: check if user's email matches any account
				const userEmail = session?.user?.email?.toLowerCase();
				if (userEmail) {
					// Try exact match first
					const emailUsername = userEmail.split("@")[0]; // Get part before @
					const exactMatch = data.accounts.find(
						(account) => account.toLowerCase() === emailUsername,
					);

					if (exactMatch) {
						setSelectedErpAccount(exactMatch);
						setSuggestedAccount(exactMatch);
					} else {
						// Try partial match (case-insensitive contains)
						const partialMatch = data.accounts.find((account) =>
							account.toLowerCase().includes(emailUsername),
						);

						if (partialMatch) {
							setSelectedErpAccount(partialMatch);
							setSuggestedAccount(partialMatch);
						}
					}
				}
			} catch (err) {
				setAccountsError(
					err instanceof Error ? err.message : "An error occurred",
				);
				setErpAccounts([]);
			} finally {
				setIsLoadingAccounts(false);
			}
		};

		fetchErpAccounts();
	}, [selectedSite, session?.user?.email]);

	const handleSiteSelection = (siteId: string) => {
		// Reset ERP account when changing site
		if (siteId !== selectedSite) {
			setSelectedErpAccount("");
			setSuggestedAccount("");
		}
		setSelectedSite(siteId);
	};

	const handleSubmit = async () => {
		if (!selectedSite || !selectedErpAccount) {
			setError("Please select both site and ERP account");
			return;
		}

		setIsSubmitting(true);
		setError("");

		try {
			const response = await fetch("/api/user/update-site", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					site: selectedSite,
					erpAccount: selectedErpAccount,
				}),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || "Failed to complete setup");
			}

			// Redirect to internal followup page after successful update
			router.push("/internal/followup");
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isPending) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	return (
		<div className="flex items-center justify-center min-h-screen bg-muted/50 px-4 py-8 w-full">
			<div className="w-full max-w-md">
				<div className="mb-8 text-center sm:mb-10">
					<h1 className="text-2xl font-bold sm:text-3xl">
						Complete Your Profile
					</h1>
					<p className="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-base">
						Select your work location and ERP account
					</p>
				</div>

				<div className="space-y-6">
					{error && (
						<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive sm:p-4 flex items-start gap-2">
							<AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
							<span>{error}</span>
						</div>
					)}

					{/* Site Selection */}
					<div className="space-y-3">
						<label className="text-sm font-medium">1. Select Your Site</label>
						<div className="grid grid-cols-1 gap-3 sm:gap-4">
							{SITES.map((site) => (
								<Button
									key={site.id}
									onClick={() => handleSiteSelection(site.id)}
									disabled={isSubmitting}
									variant={selectedSite === site.id ? "default" : "outline"}
									className="justify-start h-auto py-4 sm:py-5"
								>
									<div className="flex flex-col items-start gap-1.5 text-left">
										<span className="font-semibold text-sm sm:text-base">
											{site.label}
										</span>
										<span className="text-xs opacity-75">{site.id}</span>
									</div>
									{selectedSite === site.id && (
										<CheckCircle2 className="ml-auto h-4 w-4" />
									)}
								</Button>
							))}
						</div>
					</div>

					{/* ERP Account Selection */}
					{selectedSite && (
						<div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
							<label className="text-sm font-medium">
								2. Select Your ERP Account
							</label>

							{isLoadingAccounts ? (
								<div className="flex items-center justify-center h-20 border rounded-md bg-muted/30">
									<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
									<span className="ml-2 text-sm text-muted-foreground">
										Loading accounts...
									</span>
								</div>
							) : accountsError ? (
								<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
									<AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
									<span>{accountsError}</span>
								</div>
							) : (
								<>
									<Select
										value={selectedErpAccount}
										onValueChange={(value) =>
											setSelectedErpAccount(value as string)
										}
										disabled={isSubmitting}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Select ERP account..." />
										</SelectTrigger>
										<SelectPositioner>
											<SelectContent>
												<SelectGroup>
													<SelectLabel>
														ERP Accounts ({erpAccounts.length})
													</SelectLabel>
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
												</SelectGroup>
											</SelectContent>
										</SelectPositioner>
									</Select>

									{suggestedAccount &&
										selectedErpAccount === suggestedAccount && (
											<div className="rounded-md bg-primary/10 p-3 text-sm text-primary flex items-start gap-2">
												<CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
												<span>
													This account matches your email. You can change it if
													needed.
												</span>
											</div>
										)}
								</>
							)}
						</div>
					)}

					{/* Submit Button */}
					{selectedSite && selectedErpAccount && !isLoadingAccounts && (
						<div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
							<div className="rounded-md bg-muted/50 p-4 space-y-2">
								<p className="text-sm font-medium">Summary:</p>
								<div className="text-sm text-muted-foreground space-y-1">
									<p>
										Site:{" "}
										<span className="font-medium text-foreground">
											{selectedSite}
										</span>
									</p>
									<p>
										ERP Account:{" "}
										<span className="font-medium text-foreground">
											{selectedErpAccount}
										</span>
									</p>
								</div>
							</div>

							<Button
								onClick={handleSubmit}
								disabled={isSubmitting}
								className="w-full"
							>
								{isSubmitting ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Completing Setup...
									</>
								) : (
									"Complete Setup"
								)}
							</Button>

							<p className="text-xs text-muted-foreground text-center sm:text-sm">
								This selection cannot be changed after confirmation.
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
