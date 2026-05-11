"use client";

import {
	ChevronRight,
	Home,
	LogOut,
	PanelLeftClose,
	PanelLeftOpen,
	Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { apiFetch } from "@/lib/api/client";
import { signOut, useSession } from "@/lib/auth-client";
import { useUserRole } from "@/lib/auth-utils";
import { navigationItems } from "@/lib/constants/menu";
import { cn } from "@/lib/utils";
import { filterMenuItems } from "@/lib/utils/menu-filter";
import { Button } from "./ui/button";

export function AppSidebar() {
	const pathname = usePathname();
	const router = useRouter();
	const userRole = useUserRole();
	const { data: session } = useSession();
	const [mounted, setMounted] = useState(false);
	const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
	const [userDepartments, setUserDepartments] = useState<string[]>([]);
	const [_loadingDepartments, setLoadingDepartments] = useState(false);
	const { state, toggleSidebar } = useSidebar();
	const isCollapsed = state === "collapsed";
	const sidebarLogoDisplayPx = isCollapsed ? 36 : 42;

	useEffect(() => {
		setMounted(true);
	}, []);

	const fetchUserDepartments = useCallback(async () => {
		try {
			setLoadingDepartments(true);
			const response = await apiFetch("/api/user/departments");
			if (response.ok) {
				const data = await response.json();
				setUserDepartments(data.departments || []);
			}
		} catch (error) {
			console.error("Failed to fetch user departments:", error);
		} finally {
			setLoadingDepartments(false);
		}
	}, []);

	// Fetch user's departments when session loads
	useEffect(() => {
		if (session?.user?.id && mounted) {
			fetchUserDepartments();
		}
	}, [session?.user?.id, mounted, fetchUserDepartments]);

	const isActive = (path: string) => pathname === path;

	// Filter menu items based on role and department
	const filteredNavigationItems = filterMenuItems(
		navigationItems,
		userRole as any,
		userDepartments,
	);

	return (
		<Sidebar
			collapsible="icon"
			className="z-50 border-r border-gray-200/50 dark:border-gray-800/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl transition-all duration-200"
		>
			{/* Header with Logo and Toggle */}
			<SidebarHeader
				className={cn(
					"relative transition-all duration-200 flex flex-row items-center",
					isCollapsed ? "px-0 py-8 justify-center" : "px-6 py-8",
				)}
			>
				<Link
					href="/"
					className={cn(
						"flex items-center gap-3 group transition-all duration-200",
						isCollapsed ? "justify-center" : "px-2",
					)}
				>
					<div className="relative flex-shrink-0">
						<div className="absolute inset-0 bg-blue-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
						<div className="relative transition-transform duration-500 group-hover:scale-110">
							<Image
								src="/logo.png"
								alt="VVMV logo"
								width={240}
								height={80}
								sizes={`${sidebarLogoDisplayPx}px`}
								style={{
									width: sidebarLogoDisplayPx,
									height: "auto",
								}}
								className="block max-w-none"
							/>
						</div>
					</div>
					{!isCollapsed && (
						<div className="flex flex-col opacity-100 transition-opacity duration-300">
							<span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white leading-none">
								VVMV
							</span>
							<span className="text-[10px] uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 font-bold">
								Logistics
							</span>
						</div>
					)}
				</Link>

				{/* Modern Toggle Button */}
				{!isCollapsed && (
					<Button
						variant="ghost"
						size="icon"
						onClick={toggleSidebar}
						className="ml-auto h-8 w-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
					>
						<PanelLeftClose className="w-4 h-4" />
					</Button>
				)}
				{isCollapsed && (
					<Button
						variant="ghost"
						size="icon"
						onClick={toggleSidebar}
						className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-blue-600 text-white shadow-lg hover:scale-110 transition-transform z-50 flex items-center justify-center p-0"
					>
						<PanelLeftOpen className="w-3 h-3" />
					</Button>
				)}
			</SidebarHeader>

			<SidebarContent
				className={cn(
					"transition-all duration-200",
					isCollapsed ? "px-2" : "px-3",
				)}
			>
				{/* Main Navigation */}
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu className="gap-1.5">
							{/* Home Link (Static) */}
							<SidebarMenuItem>
								<SidebarMenuButton
									isActive={isActive("/")}
									className={cn(
										"h-12 rounded-xl transition-all duration-200",
										isCollapsed ? "justify-center px-0" : "px-4",
										isActive("/")
											? "bg-blue-600 text-white font-semibold shadow-lg"
											: "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400",
									)}
									render={
										<Link
											href="/"
											className={cn(
												"flex items-center w-full",
												isCollapsed ? "justify-center" : "gap-3",
											)}
										>
											<Home
												className={cn(
													"w-5 h-5",
													isActive("/")
														? "text-blue-600"
														: "text-gray-400 group-hover:text-gray-900",
												)}
											/>
											{!isCollapsed && <span>Home</span>}
											{isActive("/") && !isCollapsed && (
												<div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
											)}
										</Link>
									}
								/>
							</SidebarMenuItem>

							{/* Dynamic Items */}
							{mounted &&
								filteredNavigationItems.map((item) => {
									const Icon = item.icon;
									const active = item.link ? isActive(item.link) : false;
									const hasSubItems = item.items && item.items.length > 0;

									if (hasSubItems) {
										return (
											<Collapsible
												key={item.title}
												open={
													openMap[item.title] ??
													pathname.startsWith(item.link || "/internal/trucking")
												}
												onOpenChange={(open) =>
													setOpenMap((prev) => ({
														...prev,
														[item.title]: open,
													}))
												}
											>
												<SidebarMenuItem>
													<SidebarMenuButton
														isActive={active}
														onClick={() =>
															setOpenMap((prev) => ({
																...prev,
																[item.title]: !(
																	prev[item.title] ??
																	pathname.startsWith(
																		item.link || "/internal/trucking",
																	)
																),
															}))
														}
														className={cn(
															"h-12 rounded-xl transition-all duration-200 group",
															isCollapsed ? "justify-center px-0" : "px-4",
															active
																? "bg-gradient-to-r from-blue-600/10 to-transparent text-blue-600 dark:text-blue-400 font-semibold"
																: "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400",
														)}
													>
														{Icon && (
															<Icon
																className={cn(
																	"w-5 h-5 transition-colors",
																	active
																		? "text-blue-600"
																		: "text-gray-400 group-hover:text-blue-500",
																)}
															/>
														)}
														{!isCollapsed && (
															<span className="flex-1">{item.title}</span>
														)}
														{!isCollapsed && (
															<ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
														)}
													</SidebarMenuButton>
													<CollapsibleContent>
														<SidebarMenuSub>
															{item.items?.map((subItem) => {
																const subActive = subItem.link
																	? isActive(subItem.link)
																	: false;
																const hasNestedItems =
																	subItem.items && subItem.items.length > 0;

																if (hasNestedItems) {
																	return (
																		<Collapsible
																			key={subItem.title}
																			open={
																				openMap[subItem.title] ??
																				subItem.items?.some(
																					(ni) =>
																						ni.link &&
																						pathname.startsWith(ni.link),
																				)
																			}
																			onOpenChange={(open) =>
																				setOpenMap((prev) => ({
																					...prev,
																					[subItem.title]: open,
																				}))
																			}
																		>
																			<SidebarMenuSubItem className="relative flex flex-col group/sub-collapsible">
																				<SidebarMenuSubButton
																					render={<button />}
																					isActive={subActive}
																					onClick={() =>
																						setOpenMap((prev) => ({
																							...prev,
																							[subItem.title]: !(
																								prev[subItem.title] ??
																								subItem.items?.some(
																									(ni) =>
																										ni.link &&
																										pathname.startsWith(
																											ni.link,
																										),
																								)
																							),
																						}))
																					}
																					className={cn(
																						"w-full justify-between h-9 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer",
																						subActive &&
																							"bg-blue-50 dark:bg-blue-900/20 text-blue-600",
																					)}
																				>
																					<span className="font-medium text-xs tracking-tight">
																						{subItem.title}
																					</span>
																					<ChevronRight className="size-3.5 opacity-40 transition-transform duration-200 group-data-[state=open]/sub-collapsible:rotate-90" />
																				</SidebarMenuSubButton>
																				<CollapsibleContent>
																					<SidebarMenuSub className="ml-3 border-l border-slate-100 dark:border-slate-800 pl-3 mt-1 pb-1 flex flex-col gap-0.5">
																						{subItem.items?.map((nested) => {
																							const nActive = nested.link
																								? isActive(nested.link)
																								: false;
																							return (
																								<SidebarMenuSubItem
																									key={nested.title}
																								>
																									<SidebarMenuSubButton
																										render={
																											<Link
																												href={
																													nested.link ?? "#"
																												}
																											>
																												{nested.title}
																											</Link>
																										}
																										isActive={nActive}
																										className={cn(
																											"h-8 text-[11px] font-bold uppercase tracking-wider",
																											nActive &&
																												"text-blue-600 dark:text-blue-400 font-black",
																										)}
																									/>
																								</SidebarMenuSubItem>
																							);
																						})}
																					</SidebarMenuSub>
																				</CollapsibleContent>
																			</SidebarMenuSubItem>
																		</Collapsible>
																	);
																}

																return (
																	<SidebarMenuSubItem
																		key={subItem.title}
																		className={cn(
																			subActive &&
																				"before:absolute before:-left-[11px] before:top-0 before:bottom-0 before:w-[2px] before:bg-blue-600 before:dark:bg-blue-400 before:rounded-full",
																		)}
																	>
																		<SidebarMenuSubButton
																			render={
																				<Link href={subItem.link ?? "#"}>
																					{subItem.title}
																				</Link>
																			}
																			isActive={subActive}
																			className={cn(
																				subActive &&
																					"text-blue-700 dark:text-blue-300 font-semibold bg-blue-50 dark:bg-blue-950/30",
																			)}
																		/>
																	</SidebarMenuSubItem>
																);
															})}
														</SidebarMenuSub>
													</CollapsibleContent>
												</SidebarMenuItem>
											</Collapsible>
										);
									}

									return (
										<SidebarMenuItem key={item.title}>
											<SidebarMenuButton
												isActive={active}
												nativeButton={false}
												className={cn(
													"h-12 rounded-xl transition-all duration-200 group",
													isCollapsed ? "justify-center px-0" : "px-4",
													active
														? "bg-blue-600 text-white font-semibold shadow-lg"
														: "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400",
												)}
												render={
													<Link
														href={item.link ?? "/"}
														className={cn(
															"flex items-center w-full",
															isCollapsed ? "justify-center" : "gap-3",
														)}
													>
														{Icon && (
															<Icon
																className={cn(
																	"w-5 h-5 transition-colors",
																	active
																		? "text-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]"
																		: "text-gray-400 group-hover:text-blue-500",
																)}
															/>
														)}
														{!isCollapsed && (
															<span className="flex-1">{item.title}</span>
														)}
														{active && !isCollapsed && (
															<div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
														)}
														{!active && !isCollapsed && (
															<ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-40 -translate-x-2 group-hover:translate-x-0 transition-all" />
														)}
													</Link>
												}
											/>
										</SidebarMenuItem>
									);
								})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* Status Card */}
				<div
					className={cn(
						"mt-auto pb-4 transition-all duration-200",
						isCollapsed ? "px-1" : "px-2",
					)}
				>
					<div
						className={cn(
							"relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-xl transition-all duration-500",
							isCollapsed
								? "p-2 aspect-square flex items-center justify-center"
								: "p-4",
						)}
					>
						<div className="relative z-10 flex flex-col gap-2">
							<div
								className={cn(
									"flex items-center gap-2 text-blue-200",
									isCollapsed && "justify-center",
								)}
							>
								<div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
								{!isCollapsed && (
									<span className="text-[10px] font-bold uppercase tracking-wider">
										Operational Status
									</span>
								)}
							</div>
							{!isCollapsed && (
								<p className="text-xs font-medium leading-relaxed opacity-90">
									System is running smoothly. All services active.
								</p>
							)}
							{isCollapsed && <Truck className="w-5 h-5 text-blue-200" />}
						</div>
						{/* Glassmorphism decoration */}
						<div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
					</div>
				</div>
			</SidebarContent>

			{/* Footer Profile */}
			<SidebarFooter
				className={cn(
					"border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 transition-all duration-200",
					isCollapsed ? "p-2" : "p-4",
				)}
			>
				{mounted && session && (
					<div className="flex flex-col gap-4">
						<div
							className={cn(
								"flex items-center gap-3",
								isCollapsed ? "justify-center px-0" : "px-2 py-1",
							)}
						>
							<div className="relative flex-shrink-0">
								{session.user?.image ? (
									<Image
										src={session.user.image}
										alt={session.user?.name || "User"}
										width={isCollapsed ? 36 : 40}
										height={isCollapsed ? 36 : 40}
										className="rounded-xl border border-white dark:border-gray-700 shadow-md object-cover"
									/>
								) : (
									<div
										className={cn(
											"flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm font-bold shadow-lg",
											isCollapsed ? "h-9 w-9" : "h-10 w-10",
										)}
									>
										{session.user?.name?.charAt(0).toUpperCase() || "U"}
									</div>
								)}
								<div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 shadow-sm" />
							</div>
							{!isCollapsed && (
								<div className="flex flex-col min-w-0 opacity-100 transition-opacity duration-300">
									<span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate leading-none mb-1">
										{session.user?.name}
									</span>
									<span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight truncate">
										{session.user?.role}
									</span>
								</div>
							)}
						</div>

						<Button
							variant="ghost"
							onClick={async () => {
								await signOut();
								router.push("/login");
							}}
							className={cn(
								"w-full justify-start gap-3 h-10 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30 group",
								isCollapsed ? "justify-center px-0" : "px-4",
							)}
						>
							<LogOut className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
							{!isCollapsed && (
								<span className="text-sm font-bold tracking-tight">
									Sign Out
								</span>
							)}
						</Button>
					</div>
				)}
			</SidebarFooter>
		</Sidebar>
	);
}
