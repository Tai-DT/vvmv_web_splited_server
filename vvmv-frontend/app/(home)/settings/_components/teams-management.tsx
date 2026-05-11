"use client";

import {
	Briefcase,
	Crown,
	Search,
	Trash2,
	UserCheck,
	Users,
} from "lucide-react";
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
import { AddTeamDialog } from "./add-team-dialog";
import { SiteBadge } from "./badge-helpers";
import { EditTeamDialog } from "./edit-team-dialog";

interface Team {
	id: string;
	name: string;
	site: string;
	createdAt: string;
	leaders: {
		id: string;
		name: string;
		email: string;
		role: string;
		image?: string | null;
	}[];
	members: {
		id: string;
		name: string;
		email: string;
		role: string;
		image?: string | null;
	}[];
	department?: {
		id: string;
		name: string;
		description: string | null;
		site: "SGN" | "HAN" | "DAD";
	} | null;
}

interface TeamsManagementProps {
	readOnly?: boolean;
}

export function TeamsManagement({ readOnly = false }: TeamsManagementProps) {
	const [teams, setTeams] = useState<Team[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [confirmDialog, setConfirmDialog] = useState<{
		open: boolean;
		teamId: string | null;
		teamName: string | null;
	}>({
		open: false,
		teamId: null,
		teamName: null,
	});

	const loadTeams = useCallback(async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/admin/teams");
			const data = await response.json();

			if (response.ok && data.teams) {
				setTeams(data.teams);
			} else {
				throw new Error(data.message || "Failed to load teams");
			}
		} catch (error) {
			toast.error("Failed to load teams", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadTeams();
	}, [loadTeams]);

	const handleDelete = async (teamId: string, teamName: string) => {
		setConfirmDialog({
			open: true,
			teamId,
			teamName,
		});
	};

	const confirmDelete = async () => {
		const { teamId, teamName } = confirmDialog;
		if (!teamId || !teamName) return;

		try {
			const response = await fetch(`/api/admin/teams?id=${teamId}`, {
				method: "DELETE",
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || "Failed to delete team");
			}

			toast.success("Team deleted successfully");
			loadTeams();
		} catch (error) {
			toast.error("Failed to delete team", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setConfirmDialog({ open: false, teamId: null, teamName: null });
		}
	};

	const filteredTeams = teams.filter(
		(team) =>
			team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			team.leaders.some(
				(leader) =>
					leader.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					leader.email?.toLowerCase().includes(searchTerm.toLowerCase()),
			) ||
			team.members.some(
				(member) =>
					member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					member.email?.toLowerCase().includes(searchTerm.toLowerCase()),
			),
	);

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
			<div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-4 md:p-6">
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
					<div className="flex items-center gap-2 md:gap-3">
						<div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
							<Users className="h-5 md:h-6 w-5 md:w-6 text-white" />
						</div>
						<div>
							<h2 className="text-lg md:text-xl font-bold text-white">
								{readOnly ? "Teams (Read Only)" : "Teams Management"}
							</h2>
							<p className="text-emerald-100 text-xs md:text-sm">
								{teams.length} teams in system
							</p>
						</div>
					</div>
					{!readOnly && <AddTeamDialog onTeamCreated={loadTeams} />}
				</div>
			</div>

			{/* Search Bar */}
			<div className="p-3 md:p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
				<div className="relative w-full md:max-w-md">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
					<Input
						type="text"
						placeholder="Search teams..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-10 bg-white dark:bg-gray-900 text-sm"
					/>
				</div>
			</div>

			{/* Teams Grid */}
			<div className="p-3 md:p-6">
				{filteredTeams.length === 0 ? (
					<div className="text-center py-8 md:py-12">
						<div className="w-12 md:w-16 h-12 md:h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
							<Users className="h-6 md:h-8 w-6 md:w-8 text-gray-400" />
						</div>
						<p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
							No teams found
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
						{filteredTeams.map((team) => (
							<div
								key={team.id}
								className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 overflow-hidden hover:shadow-lg transition-all hover:border-emerald-300 dark:hover:border-emerald-600 relative"
							>
								{/* Team Header */}
								<div className="p-3 md:p-4 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700/50 dark:to-gray-800/50 border-b border-gray-200 dark:border-gray-700">
									<div className="flex items-start justify-between gap-2">
										<div className="flex items-start gap-2 md:gap-3 min-w-0 flex-1">
											<div className="p-1.5 md:p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex-shrink-0">
												<Users className="w-4 md:w-5 h-4 md:h-5 text-emerald-600 dark:text-emerald-400" />
											</div>
											<div className="min-w-0 flex-1">
												<h3 className="font-bold text-sm md:text-base text-gray-900 dark:text-white truncate">
													{team.name}
												</h3>
												<div className="flex flex-wrap items-center gap-1.5 mt-1">
													<SiteBadge site={team.site} />
													{team.department && (
														<div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-800/50 flex-shrink-0">
															<Briefcase className="w-2.5 h-2.5 md:w-3 md:h-3" />
															<span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider">
																{team.department.name}
															</span>
														</div>
													)}
													<span className="text-[10px] md:text-xs text-gray-500 flex-shrink-0">
														{new Date(team.createdAt).toLocaleDateString(
															undefined,
															{ month: "short", day: "numeric" },
														)}
													</span>
												</div>
											</div>
										</div>

										{!readOnly && (
											<div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
												<EditTeamDialog team={team} onTeamUpdated={loadTeams} />
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleDelete(team.id, team.name)}
													className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 w-8 p-0"
												>
													<Trash2 className="h-3.5 md:h-4 w-3.5 md:w-4" />
												</Button>
											</div>
										)}
									</div>
								</div>

								{/* Team Content */}
								<div className="p-3 md:p-4 space-y-3 md:space-y-4">
									{/* Leaders */}
									<div>
										<div className="flex items-center gap-1.5 md:gap-2 mb-2">
											<Crown className="w-3.5 md:w-4 h-3.5 md:h-4 text-amber-500" />
											<span className="text-[10px] md:text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
												Leaders ({team.leaders.length})
											</span>
										</div>
										{team.leaders.length === 0 ? (
											<p className="text-xs md:text-sm text-gray-500 italic">
												No leaders
											</p>
										) : (
											<div className="flex flex-wrap gap-1.5 md:gap-2">
												{team.leaders.map((leader) => (
													<div
														key={leader.id}
														className="inline-flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full"
													>
														<UserDisplay user={leader} size="xs" showEmail />
													</div>
												))}
											</div>
										)}
									</div>

									{/* Members */}
									<div>
										<div className="flex items-center gap-1.5 md:gap-2 mb-2">
											<UserCheck className="w-3.5 md:w-4 h-3.5 md:h-4 text-emerald-500" />
											<span className="text-[10px] md:text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
												Members ({team.members.length})
											</span>
										</div>
										{team.members.length === 0 ? (
											<p className="text-xs md:text-sm text-gray-500 italic">
												No members
											</p>
										) : (
											<div className="flex flex-wrap gap-1.5 md:gap-2">
												{team.members.map((member) => (
													<div
														key={member.id}
														className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full text-xs"
													>
														<UserDisplay user={member} size="xs" />
													</div>
												))}
											</div>
										)}
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
					Showing {filteredTeams.length} of {teams.length} teams
				</p>
			</div>

			{/* Confirm Delete Dialog */}
			<Dialog
				open={confirmDialog.open}
				onOpenChange={(open) =>
					!open &&
					setConfirmDialog({ open: false, teamId: null, teamName: null })
				}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Team</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete team {confirmDialog.teamName}?
							Team members will not be deleted.
						</DialogDescription>
					</DialogHeader>
					<div className="flex justify-end gap-3 pt-4">
						<Button
							variant="outline"
							onClick={() =>
								setConfirmDialog({ open: false, teamId: null, teamName: null })
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
