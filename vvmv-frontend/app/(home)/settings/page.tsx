"use client";

import { useQuery } from "@tanstack/react-query";
import {
	AtSign,
	Briefcase,
	Key,
	ListFilter,
	Mail,
	MapPin,
	Shield,
	User,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth-client";
import { ApiKeysManagement } from "./_components/api-keys-management";
import { CompanyColorsManagement } from "./_components/company-colors-management";
import { FieldOptionsManagement } from "./_components/field-options-management";
import { PartnersManagement } from "./_components/partners-management";
import { SiteManagement } from "./_components/site-management";
import { TeamsManagement } from "./_components/teams-management";
import { UsersManagement } from "./_components/users-management";

export default function SettingsPage() {
	const { data: session, isPending } = useSession();
	const router = useRouter();

	// Fetch team leadership status
	const { data: userTeams } = useQuery({
		queryKey: ["user-teams", session?.user?.id],
		queryFn: async () => {
			const response = await fetch("/api/user/teams");
			if (!response.ok) return null;
			return response.json();
		},
		enabled: !!session?.user?.id,
	});

	const isAdmin = session?.user?.role === "ADMIN";
	const isSuperAdmin = session?.user?.role === "SUPERADMIN";
	const isManager = session?.user?.role === "MANAGER";
	const isTeamLeader = userTeams?.isLeader || false;
	const canManage = isAdmin || isSuperAdmin || isManager;
	const canViewTeams = isAdmin || isSuperAdmin || isManager || isTeamLeader;
	const canManagePartners = canManage || isTeamLeader;

	useEffect(() => {
		if (!isPending && !session) {
			router.push("/login");
		}
	}, [session, isPending, router]);

	if (isPending) {
		return (
			<div className="min-h-screen flex items-center justify-center w-full">
				<Spinner className="size-20 text-primary" />
			</div>
		);
	}

	if (!session) {
		return null;
	}

	const user = session.user;
	const userAny = user as any;

	// Role badge colors
	const roleColors: Record<string, string> = {
		SUPERADMIN: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
		ADMIN: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
		MANAGER: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white",
		STAFF: "bg-gradient-to-r from-green-500 to-emerald-500 text-white",
		CUSTOMER: "bg-gradient-to-r from-orange-500 to-amber-500 text-white",
	};

	// Site badge colors
	const siteColors: Record<string, string> = {
		SGN: "bg-gradient-to-r from-red-500 to-orange-500 text-white",
		HAN: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
		DAD: "bg-gradient-to-r from-teal-500 to-cyan-500 text-white",
	};

	return (
		<div className="max-w-full lg:max-w-8xl mx-auto px-4 md:px-8">
			<Tabs defaultValue="account" className="w-full">
				<TabsList>
					<TabsTrigger value="account">Account</TabsTrigger>
					{canManage && <TabsTrigger value="users">Users</TabsTrigger>}
					{(isAdmin || isSuperAdmin) && (
						<TabsTrigger value="site">Site & Departments</TabsTrigger>
					)}
					{canViewTeams && <TabsTrigger value="teams">Teams</TabsTrigger>}
					<TabsTrigger value="company-colors">Company Colors</TabsTrigger>
					{canManagePartners && (
						<TabsTrigger value="partners">Partners</TabsTrigger>
					)}
					{(isAdmin || isSuperAdmin) && (
						<TabsTrigger value="api-keys">
							<Key className="size-3.5 mr-1.5" />
							API Keys
						</TabsTrigger>
					)}
					{(isAdmin || isSuperAdmin) && (
						<TabsTrigger value="field-options">
							<ListFilter className="size-3.5 mr-1.5" />
							Field Options
						</TabsTrigger>
					)}
				</TabsList>
				<TabsContent value="account">
					{/* Profile Card */}
					<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
						{/* Gradient Header */}
						<div className="h-32 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 relative">
							<div className="absolute inset-0 bg-black/10" />
							<div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-gray-800" />
						</div>

						{/* Avatar & Name Section */}
						<div className="px-4 md:px-6 pb-4 md:pb-6 -mt-12 md:-mt-16 relative">
							<div className="flex flex-col sm:flex-row items-center sm:items-end gap-3 md:gap-4">
								{/* Avatar */}
								<div className="relative">
									{user?.image ? (
										<Image
											src={user.image}
											alt={user.name || "User"}
											width={120}
											height={120}
											className="w-20 md:w-[120px] h-20 md:h-[120px] rounded-full border-4 border-white dark:border-gray-800 shadow-xl"
										/>
									) : (
										<div className="w-20 md:w-[120px] h-20 md:h-[120px] rounded-full border-4 border-white dark:border-gray-800 shadow-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
											<span className="text-2xl md:text-4xl font-bold text-white">
												{user?.name?.charAt(0).toUpperCase() || "U"}
											</span>
										</div>
									)}
									{/* Online indicator */}
									<div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
								</div>

								{/* Name & Role */}
								<div className="flex-1 text-center sm:text-left pb-2">
									<h1 className="text-2xl font-bold text-gray-900 dark:text-white">
										{user?.name || "User"}
									</h1>
									<p className="text-gray-500 dark:text-gray-400">
										@{user?.username || user?.email?.split("@")[0]}
									</p>
								</div>

								{/* Role & Site Badges */}
								<div className="flex gap-2 pb-2">
									<span
										className={`px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg ${
											roleColors[user?.role || "STAFF"] || roleColors.STAFF
										}`}
									>
										{user?.role || "STAFF"}
									</span>
									{userAny?.site && (
										<span
											className={`px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg ${
												siteColors[userAny.site] || "bg-gray-500 text-white"
											}`}
										>
											{userAny.site}
										</span>
									)}
								</div>
							</div>
						</div>

						{/* Info Cards */}
						<div className="px-4 md:px-6 pb-6 md:pb-8">
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
								{/* Email Card */}
								<div className="group p-3 md:p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all hover:scale-[1.02]">
									<div className="flex items-center gap-2 md:gap-3">
										<div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex-shrink-0">
											<Mail className="w-4 md:w-5 h-4 md:h-5 text-blue-600 dark:text-blue-400" />
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-[10px] md:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
												Email
											</p>
											<p className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white truncate">
												{user?.email}
											</p>
										</div>
									</div>
								</div>

								{/* Username Card */}
								<div className="group p-3 md:p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all hover:scale-[1.02]">
									<div className="flex items-center gap-2 md:gap-3">
										<div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex-shrink-0">
											<AtSign className="w-4 md:w-5 h-4 md:h-5 text-purple-600 dark:text-purple-400" />
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-[10px] md:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
												Username
											</p>
											<p className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white truncate">
												{user?.username || "Not set"}
											</p>
										</div>
									</div>
								</div>

								{/* Role Card */}
								<div className="group p-3 md:p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all hover:scale-[1.02]">
									<div className="flex items-center gap-2 md:gap-3">
										<div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50 flex-shrink-0">
											<Shield className="w-4 md:w-5 h-4 md:h-5 text-green-600 dark:text-green-400" />
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-[10px] md:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
												Role
											</p>
											<p className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">
												{user?.role || "STAFF"}
											</p>
										</div>
									</div>
								</div>

								{/* Site Card */}
								<div className="group p-3 md:p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all hover:scale-[1.02]">
									<div className="flex items-center gap-2 md:gap-3">
										<div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex-shrink-0">
											<MapPin className="w-4 md:w-5 h-4 md:h-5 text-orange-600 dark:text-orange-400" />
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-[10px] md:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
												Site
											</p>
											<p className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">
												{userAny?.site || "Not assigned"}
											</p>
										</div>
									</div>
								</div>

								{/* ERP Account Card */}
								<div className="group p-3 md:p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all hover:scale-[1.02]">
									<div className="flex items-center gap-2 md:gap-3">
										<div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/50 flex-shrink-0">
											<Briefcase className="w-4 md:w-5 h-4 md:h-5 text-cyan-600 dark:text-cyan-400" />
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-[10px] md:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
												ERP Account
											</p>
											<p className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white truncate">
												{userAny?.erpAccount || "Not set"}
											</p>
										</div>
									</div>
								</div>

								{/* Member Since Card */}
								<div className="group p-3 md:p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all hover:scale-[1.02]">
									<div className="flex items-center gap-2 md:gap-3">
										<div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/50 flex-shrink-0">
											<User className="w-4 md:w-5 h-4 md:h-5 text-pink-600 dark:text-pink-400" />
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-[10px] md:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
												Member Since
											</p>
											<p className="text-xs md:text-sm font-semibold text-gray-900 dark:text-white">
												{user?.createdAt
													? new Date(user.createdAt).toLocaleDateString(
															"vi-VN",
															{
																year: "numeric",
																month: "long",
																day: "numeric",
															},
														)
													: "Unknown"}
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="users">
					<UsersManagement />
				</TabsContent>
				<TabsContent value="site">
					<SiteManagement />
				</TabsContent>
				<TabsContent value="teams">
					<TeamsManagement readOnly={isTeamLeader && !canManage} />
				</TabsContent>
				<TabsContent value="company-colors">
					<CompanyColorsManagement />
				</TabsContent>
				<TabsContent value="partners">
					<PartnersManagement isAdminOnly={isAdmin || isSuperAdmin} />
				</TabsContent>
				<TabsContent value="api-keys">
					<ApiKeysManagement />
				</TabsContent>
				<TabsContent value="field-options">
					<FieldOptionsManagement />
				</TabsContent>
			</Tabs>
		</div>
	);
}
