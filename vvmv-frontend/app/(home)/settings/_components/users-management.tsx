"use client";

import { Search, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Spinner } from "@/components/ui/spinner";
import { UserDisplay } from "@/components/ui/user-display";
import { apiFetch, getFetchErrorMessage } from "@/lib/api/client";
import { AddUserDialog } from "./add-user-dialog";
import { RoleBadge, SiteBadge } from "./badge-helpers";
import { EditUserDialog } from "./edit-user-dialog";

const USERS_LOAD_ERROR_TOAST_ID = "settings-users-load-error";

function toastErrorDeduped(title: string, description?: string) {
	if (description && description.trim() && description.trim() !== title) {
		toast.error(title, { id: USERS_LOAD_ERROR_TOAST_ID, description });
	} else {
		toast.error(title, { id: USERS_LOAD_ERROR_TOAST_ID });
	}
}

interface UserType {
	id: string;
	name: string;
	email: string;
	username: string;
	role: string;
	site: string | null;
	createdAt: string;
	erpAccount: string | null;
	image?: string | null;
}

export function UsersManagement() {
	const [users, setUsers] = useState<UserType[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [confirmDialog, setConfirmDialog] = useState<{
		open: boolean;
		userId: string | null;
		userEmail: string | null;
	}>({
		open: false,
		userId: null,
		userEmail: null,
	});

	const loadUsers = useCallback(async () => {
		setLoading(true);
		try {
			const response = await apiFetch("/api/admin/users");

			if (!response.ok) {
				const msg = await getFetchErrorMessage(
					response,
					"Failed to load users",
				);
				toastErrorDeduped("Failed to load users", msg);
				return;
			}

			const data: unknown = await response.json();
			const list =
				data &&
				typeof data === "object" &&
				"users" in data &&
				Array.isArray((data as { users: unknown }).users)
					? (data as { users: UserType[] }).users
					: null;

			if (!list) {
				toastErrorDeduped(
					"Failed to load users",
					"Unexpected response from server",
				);
				return;
			}

			setUsers(list);
		} catch (error) {
			const detail = error instanceof Error ? error.message : "Unknown error";
			toastErrorDeduped("Failed to load users", detail);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadUsers();
	}, [loadUsers]);

	const handleDelete = async (userId: string, userEmail: string) => {
		setConfirmDialog({
			open: true,
			userId,
			userEmail,
		});
	};

	const confirmDelete = async () => {
		const { userId, userEmail } = confirmDialog;
		if (!userId || !userEmail) return;

		try {
			const response = await apiFetch(`/api/admin/users?id=${userId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const msg = await getFetchErrorMessage(
					response,
					"Failed to delete user",
				);
				if (msg !== "Failed to delete user") {
					toast.error("Failed to delete user", { description: msg });
				} else {
					toast.error("Failed to delete user");
				}
				return;
			}

			toast.success("User deleted successfully");
			loadUsers();
		} catch (error) {
			const detail = error instanceof Error ? error.message : "Unknown error";
			if (detail !== "Failed to delete user") {
				toast.error("Failed to delete user", { description: detail });
			} else {
				toast.error("Failed to delete user");
			}
		} finally {
			setConfirmDialog({
				open: false,
				userId: null,
				userEmail: null,
			});
		}
	};

	const filteredUsers = users.filter((user) => {
		if (!searchTerm.trim()) return true;

		const search = searchTerm.toLowerCase();
		return (
			user.name?.toLowerCase().includes(search) ||
			user.email?.toLowerCase().includes(search) ||
			user.username?.toLowerCase().includes(search) ||
			user.erpAccount?.toLowerCase().includes(search)
		);
	});

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner className="h-8 w-8" />
			</div>
		);
	}

	return (
		<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
			{/* Header with Gradient */}
			<div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 md:p-6">
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
					<div className="flex items-center gap-2 md:gap-3">
						<div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
							<Users className="h-5 md:h-6 w-5 md:w-6 text-white" />
						</div>
						<div>
							<h2 className="text-lg md:text-xl font-bold text-white">
								Users Management
							</h2>
							<p className="text-blue-100 text-xs md:text-sm">
								{users.length} users in system
							</p>
						</div>
					</div>
					<AddUserDialog onUserCreated={loadUsers} />
				</div>
			</div>

			{/* Search Bar */}
			<div className="p-3 md:p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
				<div className="relative w-full md:max-w-md">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
					<Input
						type="text"
						placeholder="Search users..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-10 bg-white dark:bg-gray-900 text-sm"
					/>
				</div>
			</div>

			{/* Users Grid */}
			<div className="p-3 md:p-6">
				{filteredUsers.length === 0 ? (
					<div className="text-center py-8 md:py-12">
						<div className="w-12 md:w-16 h-12 md:h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
							<Users className="h-6 md:h-8 w-6 md:w-8 text-gray-400" />
						</div>
						<p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
							No users found
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
						{filteredUsers.map((user) => (
							<div
								key={user.id}
								className="group p-3 md:p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 hover:shadow-lg transition-all hover:scale-[1.02] hover:border-blue-300 dark:hover:border-blue-600"
							>
								{/* User Info */}
								<div className="flex items-start gap-2 md:gap-3 mb-3">
									<UserDisplay user={user} size="sm" showEmail />
								</div>

								{/* Meta Info */}
								<div className="flex flex-wrap gap-1.5 md:gap-2 mb-3">
									<RoleBadge role={user.role} />
									<SiteBadge site={user.site} />
								</div>

								{/* ERP Account */}
								{user.erpAccount && (
									<p className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400 mb-3 truncate">
										ERP: <span className="font-medium">{user.erpAccount}</span>
									</p>
								)}

								{/* Actions */}
								<div className="flex items-center justify-between pt-2 md:pt-3 border-t border-gray-200 dark:border-gray-700">
									<span className="text-[10px] md:text-xs text-gray-400">
										{new Date(user.createdAt).toLocaleDateString(undefined, {
											month: "short",
											day: "numeric",
										})}
									</span>
									<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<EditUserDialog user={user} onUserUpdated={loadUsers} />
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleDelete(user.id, user.email)}
											className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 w-8 p-0"
										>
											<Trash2 className="h-3.5 md:h-4 w-3.5 md:w-4" />
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="px-3 md:px-6 py-3 md:py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
				<p className="text-xs md:text-sm text-gray-500">
					Showing {filteredUsers.length} of {users.length} users
				</p>
			</div>

			{/* Confirm Delete Dialog */}
			<Dialog
				open={confirmDialog.open}
				onOpenChange={(open) =>
					!open &&
					setConfirmDialog({
						open: false,
						userId: null,
						userEmail: null,
					})
				}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm Deletion</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete user {confirmDialog.userEmail}?
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<div className="flex justify-end gap-3 pt-4">
						<Button
							variant="outline"
							onClick={() =>
								setConfirmDialog({
									open: false,
									userId: null,
									userEmail: null,
								})
							}
						>
							Cancel
						</Button>
						<Button variant="destructive" onClick={confirmDelete}>
							Delete
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
