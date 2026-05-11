"use client";

import { Building2, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/lib/auth-client";
import { DepartmentManagersCard } from "./department-managers-card";

interface User {
	id: string;
	name: string | null;
	email: string;
	role: string;
	site: string | null;
	image?: string | null;
}

interface Department {
	id: string;
	name: string;
	description: string | null;
	site: "SGN" | "HAN" | "DAD";
	_count: {
		teams: number;
	};
	teams?: {
		id: string;
		name: string;
		createdAt: string;
		leaders: {
			user: {
				id: string;
				name: string;
				email: string;
				role: string;
				image?: string | null;
			};
		}[];
		members: {
			user: {
				id: string;
				name: string;
				email: string;
				role: string;
				image?: string | null;
			};
		}[];
	}[];
}

interface DepartmentManager {
	id: string;
	userId: string;
	departmentId: string;
	user: User;
	department: Department;
}

const siteInfo = {
	SGN: {
		name: "Ho Chi Minh City",
		gradient: "from-red-500 to-orange-500",
		bgGradient:
			"from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20",
		borderColor: "border-red-200 dark:border-red-800",
		iconBg: "bg-red-100 dark:bg-red-900/50",
		iconColor: "text-red-600 dark:text-red-400",
	},
	HAN: {
		name: "Ha Noi",
		gradient: "from-blue-500 to-indigo-500",
		bgGradient:
			"from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20",
		borderColor: "border-blue-200 dark:border-blue-800",
		iconBg: "bg-blue-100 dark:bg-blue-900/50",
		iconColor: "text-blue-600 dark:text-blue-400",
	},
	DAD: {
		name: "Da Nang",
		gradient: "from-teal-500 to-cyan-500",
		bgGradient:
			"from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20",
		borderColor: "border-teal-200 dark:border-teal-800",
		iconBg: "bg-teal-100 dark:bg-teal-900/50",
		iconColor: "text-teal-600 dark:text-teal-400",
	},
};

export function SiteManagement() {
	const { data: session } = useSession();
	const [users, setUsers] = useState<User[]>([]);
	const [departments, setDepartments] = useState<Department[]>([]);
	const [assignments, setAssignments] = useState<DepartmentManager[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const userSite = (session?.user as any)?.site as string | undefined;
	const isSuperAdmin = (session?.user as any)?.role === "SUPERADMIN";
	const allSites: ("SGN" | "HAN" | "DAD")[] = ["SGN", "HAN", "DAD"];
	const sites: ("SGN" | "HAN" | "DAD")[] =
		isSuperAdmin || !userSite
			? allSites
			: allSites.filter((site) => site === userSite);

	const loadData = useCallback(async () => {
		setIsLoading(true);
		try {
			const [usersRes, deptsRes, assignmentsRes] = await Promise.all([
				fetch("/api/admin/users"),
				fetch("/api/admin/departments?includeTeams=true"),
				fetch("/api/admin/department-managers"),
			]);

			if (!usersRes.ok || !deptsRes.ok || !assignmentsRes.ok) {
				throw new Error("Failed to load data");
			}

			const usersData = await usersRes.json();
			const deptsData = await deptsRes.json();
			const assignmentsData = await assignmentsRes.json();

			setUsers(usersData.users || []);
			setDepartments(deptsData.departments || []);
			setAssignments(assignmentsData.assignments || []);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to load data",
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Load initial data
	useEffect(() => {
		loadData();
	}, [loadData]);

	const getDepartmentsForSite = (site: "SGN" | "HAN" | "DAD") => {
		return departments.filter((d) => d.site === site);
	};

	const getManagersForDepartment = (departmentId: string) => {
		return assignments
			.filter((a) => a.departmentId === departmentId)
			.map((a) => a.user);
	};

	const getAvailableUsers = (site: "SGN" | "HAN" | "DAD") => {
		// Get all MANAGER and ADMIN users from the site OR without a site
		return users.filter(
			(u) =>
				(u.site === site || u.site === null) &&
				(u.role === "MANAGER" || u.role === "ADMIN"),
		);
	};

	const handleAssignManager = async (departmentId: string, userId: string) => {
		try {
			const response = await fetch("/api/admin/department-managers", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId,
					departmentIds: [departmentId],
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to assign manager");
			}

			// Reload assignments
			const assignmentsRes = await fetch("/api/admin/department-managers");
			const assignmentsData = await assignmentsRes.json();
			setAssignments(assignmentsData.assignments || []);

			toast.success("Manager assigned to department");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to assign manager",
			);
			throw error;
		}
	};

	const handleRemoveManager = async (
		departmentId: string,
		userId: string,
		managerName: string,
	) => {
		try {
			const response = await fetch(
				`/api/admin/department-managers?userId=${userId}&departmentId=${departmentId}`,
				{
					method: "DELETE",
				},
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to remove manager");
			}

			// Reload assignments
			const assignmentsRes = await fetch("/api/admin/department-managers");
			const assignmentsData = await assignmentsRes.json();
			setAssignments(assignmentsData.assignments || []);

			toast.success(`${managerName} removed from department`);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to remove manager",
			);
			throw error;
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-12">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
			{/* Header with Gradient */}
			<div className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 p-6">
				<div className="flex items-center gap-3">
					<div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
						<Building2 className="h-6 w-6 text-white" />
					</div>
					<div>
						<h2 className="text-xl font-bold text-white">Site & Departments</h2>
						<p className="text-pink-100 text-sm">
							Manage site departments and assign managers
						</p>
					</div>
				</div>
			</div>

			{/* Sites Grid - Responsive Layout */}
			<div className="p-3 md:p-6 flex flex-col lg:flex-row gap-4 md:gap-6 w-full">
				{sites.map((siteCode) => {
					const info = siteInfo[siteCode];
					const siteDepartments = getDepartmentsForSite(siteCode);

					return (
						<div
							key={siteCode}
							className="w-full rounded-lg md:rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 flex flex-col"
						>
							{/* Site Header */}
							<div
								className={`p-3 md:p-4 bg-gradient-to-r ${info.gradient} flex items-center gap-2 md:gap-3`}
							>
								<div className="p-1.5 md:p-2 bg-white/20 rounded-lg backdrop-blur-sm">
									<MapPin className="w-4 h-4 md:w-5 md:h-5 text-white" />
								</div>
								<div className="flex-1">
									<h3 className="font-bold text-white text-sm md:text-base">
										{siteCode}
									</h3>
									<p className="text-white/80 text-[10px] md:text-xs">
										{info.name}
									</p>
								</div>
								{siteDepartments.length > 0 && (
									<Badge className="bg-white/20 text-white border-0 text-[10px] md:text-xs">
										{siteDepartments.length}
									</Badge>
								)}
							</div>

							{/* Departments for this Site */}
							<div className="flex-1 p-3 md:p-4 space-y-2 md:space-y-3 overflow-y-auto">
								{siteDepartments.length > 0 ? (
									siteDepartments.map((dept) => (
										<DepartmentManagersCard
											key={dept.id}
											department={dept}
											managers={getManagersForDepartment(dept.id)}
											availableUsers={getAvailableUsers(siteCode)}
											onAssignManager={handleAssignManager}
											onRemoveManager={handleRemoveManager}
										/>
									))
								) : (
									<div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-center text-gray-500 dark:text-gray-400 text-sm">
										No departments
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
