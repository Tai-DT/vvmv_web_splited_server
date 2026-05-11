"use client";

import { ChevronsUpDown, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
	DialogTrigger,
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
import { UserDisplay } from "@/components/ui/user-display";
import { useSession } from "@/lib/auth-client";

interface User {
	id: string;
	name: string;
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
}

interface AddTeamDialogProps {
	onTeamCreated: () => void;
}

export function AddTeamDialog({ onTeamCreated }: AddTeamDialogProps) {
	const { data: session } = useSession();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [formLoading, setFormLoading] = useState(false);
	const [users, setUsers] = useState<User[]>([]);
	const [leaderOpen, setLeaderOpen] = useState(false);
	const [memberOpen, setMemberOpen] = useState(false);
	const [departments, setDepartments] = useState<Department[]>([]);
	const [formData, setFormData] = useState({
		name: "",
		site: "" as "SGN" | "HAN" | "DAD" | "",
		departmentId: "",
		leaderIds: [] as string[],
		memberIds: [] as string[],
	});

	const loadUsers = useCallback(async () => {
		try {
			const response = await fetch("/api/admin/users");
			const data = await response.json();

			if (response.ok && data.users) {
				setUsers(data.users);
			}
		} catch (error) {
			console.error("Failed to load users:", error);
		}
	}, []);

	const loadDepartments = useCallback(async (site: string) => {
		if (!site) {
			setDepartments([]);
			return;
		}

		try {
			const response = await fetch(
				`/api/admin/departments/by-site?site=${site}`,
			);
			const data = await response.json();

			if (response.ok && data.departments) {
				setDepartments(data.departments);
			}
		} catch (error) {
			console.error("Failed to load departments:", error);
		}
	}, []);

	useEffect(() => {
		if (isDialogOpen) {
			loadUsers();
			// For managers, auto-populate their site
			if (session?.user?.role === "MANAGER" && (session.user as any).site) {
				const site = (session.user as any).site as "SGN" | "HAN" | "DAD";
				setFormData((prev) => ({
					...prev,
					site: site,
				}));
				loadDepartments(site);
			}
		}
	}, [isDialogOpen, session, loadDepartments, loadUsers]);

	const handleCreateTeam = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormLoading(true);

		try {
			const response = await fetch("/api/admin/teams", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...formData,
					updateRoles: true,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || "Failed to create team");
			}

			toast.success("Team created successfully", {
				description: `${formData.name} has been created`,
			});

			// Reset form and close dialog
			setFormData({
				name: "",
				site: "",
				departmentId: "",
				leaderIds: [],
				memberIds: [],
			});
			setIsDialogOpen(false);
			onTeamCreated();
		} catch (error) {
			toast.error("Failed to create team", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setFormLoading(false);
		}
	};

	// Available leaders (site users not already selected)
	const availableLeaders = useMemo(() => {
		if (!formData.site) return [];
		return users.filter(
			(user) =>
				(user.site === formData.site || user.site === null) &&
				!formData.leaderIds.includes(user.id),
		);
	}, [users, formData.site, formData.leaderIds]);

	// Available members (site users not already selected as leader or member)
	const availableMembers = useMemo(() => {
		if (!formData.site) return [];
		return users.filter(
			(user) =>
				(user.site === formData.site || user.site === null) &&
				!formData.leaderIds.includes(user.id) &&
				!formData.memberIds.includes(user.id),
		);
	}, [users, formData.site, formData.leaderIds, formData.memberIds]);

	const getSelectedLeaders = () => {
		return users.filter((u) => formData.leaderIds.includes(u.id));
	};

	const getSelectedMembers = () => {
		return users.filter((u) => formData.memberIds.includes(u.id));
	};

	const handleRemoveLeader = (userId: string) => {
		setFormData({
			...formData,
			leaderIds: formData.leaderIds.filter((id) => id !== userId),
		});
	};

	const handleRemoveMember = (userId: string) => {
		setFormData({
			...formData,
			memberIds: formData.memberIds.filter((id) => id !== userId),
		});
	};

	const handleSelectLeader = (userId: string) => {
		setFormData({ ...formData, leaderIds: [...formData.leaderIds, userId] });
	};

	const handleSelectMember = (userId: string) => {
		setFormData({
			...formData,
			memberIds: [...formData.memberIds, userId],
		});
	};

	return (
		<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
			<DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
				<Plus className="h-4 w-4" /> Add Team
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create New Team</DialogTitle>
					<DialogDescription>
						Add a new team to the system. Team name, site, and at least one
						leader are required.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleCreateTeam} className="space-y-4 mt-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium mb-2">
								Team Name *
							</label>
							<Input
								type="text"
								value={formData.name}
								onChange={(e) =>
									setFormData({ ...formData, name: e.target.value })
								}
								placeholder="Sales Team A"
								required
							/>
						</div>

						<div>
							<label className="block text-sm font-medium mb-2">Site *</label>
							{session?.user?.role === "MANAGER" ? (
								<div className="px-3 py-2 rounded-md border border-input bg-muted text-sm">
									{formData.site || (session.user as any).site}
								</div>
							) : (
								<Select
									value={formData.site}
									onValueChange={(value: any) => {
										setFormData({
											...formData,
											site: value,
											departmentId: "",
											leaderIds: [],
											memberIds: [],
										});
										loadDepartments(value);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select site" />
									</SelectTrigger>
									<SelectPositioner>
										<SelectContent>
											<SelectItem value="SGN">Ho Chi Minh (SGN)</SelectItem>
											<SelectItem value="HAN">Ha Noi (HAN)</SelectItem>
											<SelectItem value="DAD">Da Nang (DAD)</SelectItem>
										</SelectContent>
									</SelectPositioner>
								</Select>
							)}
						</div>

						{/* Department Selector (Optional) */}
						<div>
							<label className="block text-sm font-medium mb-2">
								Department (Optional)
							</label>
							<Select
								value={formData.departmentId}
								onValueChange={(value: any) =>
									setFormData({ ...formData, departmentId: value })
								}
								disabled={!formData.site || departments.length === 0}
							>
								<SelectTrigger className="w-full">
									<SelectValue
										render={(_, { value }) => {
											if (!value)
												return (
													<span className="text-muted-foreground">
														Select department (optional)
													</span>
												);
											const dept = departments.find((d) => d.id === value);
											return <span>{dept?.name || value}</span>;
										}}
									/>
								</SelectTrigger>
								<SelectPositioner>
									<SelectContent>
										<SelectItem value="">No department</SelectItem>
										{departments.map((dept) => (
											<SelectItem key={dept.id} value={dept.id}>
												{dept.name}
											</SelectItem>
										))}
									</SelectContent>
								</SelectPositioner>
							</Select>
							{!formData.site && (
								<p className="text-xs text-gray-500 mt-1">
									Select a site first to choose a department
								</p>
							)}
						</div>

						{/* Team Leaders */}
						<div>
							<label className="block text-sm font-medium mb-2">
								Team Leaders *
							</label>
							<Popover open={leaderOpen} onOpenChange={setLeaderOpen}>
								<PopoverTrigger
									render={
										<Button
											variant="outline"
											role="combobox"
											aria-expanded={leaderOpen}
											disabled={!formData.site}
											className="w-full justify-between font-normal"
										/>
									}
								>
									<span className="text-muted-foreground">
										{formData.site ? "Select leaders..." : "Select site first"}
									</span>
									<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</PopoverTrigger>
								<PopoverPositioner>
									<PopoverContent className="w-[320px] p-0 z-[100]">
										<Command>
											<CommandInput
												placeholder="Search user..."
												className="h-9"
											/>
											<CommandList>
												<CommandEmpty>No users found.</CommandEmpty>
												<CommandGroup>
													{availableLeaders.map((user) => (
														<CommandItem
															key={user.id}
															value={`${user.id} ${user.name || ""} ${user.email}`}
															onSelect={() => {
																handleSelectLeader(user.id);
															}}
															className="flex items-center gap-2 py-2"
														>
															<UserDisplay
																user={user}
																size="sm"
																showEmail
																className="flex-1 min-w-0"
															/>
														</CommandItem>
													))}
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</PopoverPositioner>
							</Popover>

							{/* Selected leaders */}
							{getSelectedLeaders().length > 0 && (
								<div className="mt-3 flex flex-wrap gap-2">
									{getSelectedLeaders().map((leader) => (
										<div
											key={leader.id}
											className="inline-flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full"
										>
											<UserDisplay user={leader} size="xs" showEmail={false} />
											<button
												type="button"
												onClick={() => handleRemoveLeader(leader.id)}
												className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-full transition-colors"
											>
												<X className="h-3 w-3 text-gray-500" />
											</button>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Team Members */}
						<div>
							<label className="block text-sm font-medium mb-2">
								Team Members (Optional)
							</label>
							<Popover open={memberOpen} onOpenChange={setMemberOpen}>
								<PopoverTrigger
									render={
										<Button
											variant="outline"
											role="combobox"
											aria-expanded={memberOpen}
											disabled={!formData.site}
											className="w-full justify-between font-normal"
										/>
									}
								>
									<span className="text-muted-foreground">
										{formData.site ? "Select members..." : "Select site first"}
									</span>
									<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</PopoverTrigger>
								<PopoverPositioner>
									<PopoverContent className="w-[320px] p-0 z-[100]">
										<Command>
											<CommandInput
												placeholder="Search user..."
												className="h-9"
											/>
											<CommandList>
												<CommandEmpty>No users found.</CommandEmpty>
												<CommandGroup>
													{availableMembers.map((user) => (
														<CommandItem
															key={user.id}
															value={`${user.id} ${user.name || ""} ${user.email}`}
															onSelect={() => {
																handleSelectMember(user.id);
															}}
															className="flex items-center gap-2 py-2"
														>
															<UserDisplay
																user={user}
																size="sm"
																showEmail
																className="flex-1 min-w-0"
															/>
														</CommandItem>
													))}
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</PopoverPositioner>
							</Popover>

							{/* Selected members */}
							{getSelectedMembers().length > 0 && (
								<div className="mt-3 flex flex-wrap gap-2">
									{getSelectedMembers().map((member) => (
										<div
											key={member.id}
											className="inline-flex items-center gap-2 px-2 py-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full"
										>
											<UserDisplay user={member} size="xs" showEmail={false} />
											<button
												type="button"
												onClick={() => handleRemoveMember(member.id)}
												className="p-0.5 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-full transition-colors"
											>
												<X className="h-3 w-3 text-gray-500" />
											</button>
										</div>
									))}
								</div>
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
						<Button
							type="submit"
							disabled={formLoading || formData.leaderIds.length === 0}
						>
							{formLoading ? "Creating..." : "Create Team"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
