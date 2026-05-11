"use client";

import {
	AlertCircle,
	ChevronsUpDown,
	Crown,
	UserCheck,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
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
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import { UserDisplay } from "@/components/ui/user-display";

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

interface DepartmentManagersCardProps {
	department: Department;
	managers: User[];
	availableUsers: User[];
	onAssignManager: (departmentId: string, userId: string) => Promise<void>;
	onRemoveManager: (
		departmentId: string,
		userId: string,
		managerName: string,
	) => Promise<void>;
	isLoading?: boolean;
}

export function DepartmentManagersCard({
	department,
	managers,
	availableUsers,
	onAssignManager,
	onRemoveManager,
	isLoading = false,
}: DepartmentManagersCardProps) {
	const [openPopover, setOpenPopover] = useState(false);
	const [teamsDialogOpen, setTeamsDialogOpen] = useState(false);
	const [confirmDialog, setConfirmDialog] = useState<{
		open: boolean;
		managerId: string | null;
		managerName: string | null;
	}>({
		open: false,
		managerId: null,
		managerName: null,
	});
	const [isRemovingManager, setIsRemovingManager] = useState(false);
	const [isAssigningManager, setIsAssigningManager] = useState(false);

	const handleAssignManager = async (userId: string) => {
		setIsAssigningManager(true);
		try {
			await onAssignManager(department.id, userId);
			setOpenPopover(false);
			toast.success("Manager assigned to department");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to assign manager",
			);
		} finally {
			setIsAssigningManager(false);
		}
	};

	const handleRemoveManager = (managerId: string, managerName: string) => {
		setConfirmDialog({
			open: true,
			managerId,
			managerName,
		});
	};

	const confirmRemoveManager = async () => {
		const { managerId, managerName } = confirmDialog;
		if (!managerId || !managerName) return;

		setIsRemovingManager(true);
		try {
			await onRemoveManager(department.id, managerId, managerName);
			toast.success("Manager removed from department");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to remove manager",
			);
		} finally {
			setIsRemovingManager(false);
			setConfirmDialog({ open: false, managerId: null, managerName: null });
		}
	};

	return (
		<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
			{/* Department Header */}
			<div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-gray-900 dark:text-white">
						{department.name}
					</h3>
					<div className="flex items-center gap-2">
						{department._count.teams > 0 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setTeamsDialogOpen(true)}
								className="h-auto px-2.5 py-1 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-full font-medium cursor-pointer transition-colors"
							>
								{department._count.teams} team
								{department._count.teams > 1 ? "s" : ""}
							</Button>
						)}
					</div>
				</div>
			</div>

			{/* Department Content */}
			<div className="p-4 flex flex-col gap-4">
				{/* Managers List */}
				{managers.length > 0 ? (
					<div className="space-y-2">
						<div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
							Managers ({managers.length})
						</div>
						{managers.map((manager) => (
							<div
								key={manager.id}
								className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 shadow-sm"
							>
								<UserDisplay user={manager} size="sm" showEmail />
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										handleRemoveManager(
											manager.id,
											manager.name || manager.email,
										)
									}
									disabled={isRemovingManager}
									className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						))}
					</div>
				) : (
					<div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-200">
						<AlertCircle className="h-4 w-4 flex-shrink-0" />
						<span className="text-sm">
							No managers assigned to this department
						</span>
					</div>
				)}

				{/* Add Manager Popover */}
				<Popover open={openPopover} onOpenChange={setOpenPopover}>
					<PopoverTrigger
						render={
							<Button
								variant="outline"
								role="combobox"
								aria-expanded={openPopover}
								className="w-full justify-between font-normal bg-white dark:bg-gray-900"
								disabled={isAssigningManager || availableUsers.length === 0}
							/>
						}
					>
						<span className="text-muted-foreground">
							{availableUsers.length === 0
								? "No managers available"
								: "+ Add manager..."}
						</span>
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</PopoverTrigger>
					<PopoverPositioner>
						<PopoverContent className="w-[300px] p-0">
							<Command>
								<CommandInput placeholder="Search manager..." className="h-9" />
								<CommandList>
									<CommandEmpty>
										No managers available for this site.
									</CommandEmpty>
									<CommandGroup>
										{availableUsers.map((user) => (
											<CommandItem
												key={user.id}
												value={`${user.id} ${user.name || ""} ${user.email}`}
												onSelect={() => {
													handleAssignManager(user.id);
												}}
												disabled={isAssigningManager}
												className="flex items-center justify-between py-3"
											>
												<UserDisplay
													user={user}
													size="sm"
													showEmail
													className="flex-1 min-w-0"
												/>
												<Badge variant="outline" className="ml-2 text-xs">
													{user.role}
												</Badge>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</PopoverPositioner>
				</Popover>
			</div>

			{/* Confirm Remove Dialog */}
			<Dialog
				open={confirmDialog.open}
				onOpenChange={(open) =>
					!open &&
					setConfirmDialog({ open: false, managerId: null, managerName: null })
				}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm Removal</DialogTitle>
						<DialogDescription>
							Remove {confirmDialog.managerName} as manager from{" "}
							{department.name}?
						</DialogDescription>
					</DialogHeader>
					<div className="flex justify-end gap-3 pt-4">
						<Button
							variant="outline"
							onClick={() =>
								setConfirmDialog({
									open: false,
									managerId: null,
									managerName: null,
								})
							}
							disabled={isRemovingManager}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={confirmRemoveManager}
							disabled={isRemovingManager}
						>
							{isRemovingManager ? "Removing..." : "Remove"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Teams Dialog */}
			<Dialog open={teamsDialogOpen} onOpenChange={setTeamsDialogOpen}>
				<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Teams in {department.name}
						</DialogTitle>
						<DialogDescription>
							{department._count.teams} team
							{department._count.teams > 1 ? "s" : ""} ·{" "}
							{department.teams?.length || 0} displayed
						</DialogDescription>
					</DialogHeader>

					{department.teams && department.teams.length > 0 ? (
						<div className="space-y-4 pt-4">
							{department.teams.map((team) => (
								<div
									key={team.id}
									className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30"
								>
									{/* Team Name */}
									<div className="flex items-center gap-2 mb-3">
										<Users className="h-4 w-4 text-emerald-500 flex-shrink-0" />
										<h4 className="font-semibold text-gray-900 dark:text-white">
											{team.name}
										</h4>
										<span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
											{new Date(team.createdAt).toLocaleDateString()}
										</span>
									</div>

									{/* Team Leaders */}
									<div className="space-y-2">
										<div className="flex items-start gap-2">
											<Crown className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
											<div className="flex-1">
												<p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
													Leaders ({team.leaders.length})
												</p>
												<div className="flex flex-wrap gap-1.5">
													{team.leaders.length > 0 ? (
														team.leaders.map((tl) => (
															<div
																key={tl.user.id}
																className="inline-flex py-0.5"
															>
																<UserDisplay
																	user={tl.user}
																	size="xs"
																	showEmail={false}
																/>
															</div>
														))
													) : (
														<span className="text-[10px] text-gray-400 italic">
															No leaders
														</span>
													)}
												</div>
											</div>
										</div>

										{/* Team Members */}
										<div className="flex items-start gap-2">
											<UserCheck className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
											<div className="flex-1">
												<p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
													Members ({team.members.length})
												</p>
												<div className="flex flex-wrap gap-1.5">
													{team.members.length > 0 ? (
														team.members.map((tm) => (
															<div
																key={tm.user.id}
																className="inline-flex py-0.5"
															>
																<UserDisplay
																	user={tm.user}
																	size="xs"
																	showEmail={false}
																/>
															</div>
														))
													) : (
														<span className="text-[10px] text-gray-400 italic">
															No members
														</span>
													)}
												</div>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="py-8 text-center">
							<Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
							<p className="text-sm text-gray-600 dark:text-gray-400">
								No teams in this department
							</p>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
