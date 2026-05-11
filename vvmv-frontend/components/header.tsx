"use client";

import {
	ChevronRight,
	LogOut,
	Menu,
	Package,
	Settings,
	Truck,
	User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "./ui/sheet";

const NAV_LINKS = [
	{ href: "/", label: "Home" },
	{ href: "/about", label: "About" },
	{ href: "/services", label: "Services" },
	{ href: "/contact", label: "Contact" },
	{ href: "/external/tracking", label: "Tracking", icon: Package },
];

export function Header() {
	const { data: session } = useSession();
	const router = useRouter();
	const pathname = usePathname();
	const [isVendorAuthenticated, setIsVendorAuthenticated] = useState(false);
	const isVendorPortal = pathname.startsWith("/vendor-portal");

	const isStaff =
		session?.user?.role === "STAFF" ||
		session?.user?.role === "MANAGER" ||
		session?.user?.role === "ADMIN";

	const handleLogout = async () => {
		await signOut();
		router.push("/");
	};

	const handleVendorLogout = async () => {
		await apiFetch("/api/external/vendor-portal/logout", { method: "POST" });
		setIsVendorAuthenticated(false);
		router.push("/login");
	};

	useEffect(() => {
		if (!isVendorPortal) {
			setIsVendorAuthenticated(false);
			return;
		}

		let isMounted = true;

		const checkVendorSession = async () => {
			try {
				const res = await apiFetch("/api/external/vendor-portal/session", {
					cache: "no-store",
				});

				if (!res.ok) {
					if (isMounted) setIsVendorAuthenticated(false);
					return;
				}

				const data = await res.json();
				if (isMounted) {
					setIsVendorAuthenticated(
						Boolean(data?.authenticated && data?.vendor),
					);
				}
			} catch {
				if (isMounted) setIsVendorAuthenticated(false);
			}
		};

		checkVendorSession();

		return () => {
			isMounted = false;
		};
	}, [isVendorPortal]);

	return (
		<header className="sticky top-0 z-50 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
			<nav className="max-w-7xl mx-auto flex h-20 items-center justify-between px-6">
				{/* Logo */}
				<Link href="/" className="flex items-center gap-3 group">
					<div className="relative transition-transform group-hover:scale-105">
						<Image
							src="/logo.png"
							alt="VVMV Logo"
							width={240}
							height={80}
							className="block h-12 w-auto"
						/>
					</div>
				</Link>

				{/* Desktop Navigation Links */}
				<div className="hidden items-center gap-1 lg:flex">
					{NAV_LINKS.map((link) => (
						<Link
							key={link.label}
							href={link.href}
							className={cn(
								"px-4 py-2 rounded-lg text-sm font-medium transition-all",
								pathname === link.href
									? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
									: "text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800",
							)}
						>
							<span className="flex items-center gap-2">
								{link.icon && <link.icon className="w-4 h-4" />}
								{link.label}
							</span>
						</Link>
					))}
				</div>

				{/* Desktop Right Section */}
				<div className="hidden lg:flex items-center gap-3">
					{session?.user ? (
						<>
							{/* Dashboard Link */}
							<Link
								href={isStaff ? "/internal/followup" : "/external/tracking"}
							>
								<Button
									variant="ghost"
									className="gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
								>
									<Truck className="w-4 h-4" />
									Dashboard
								</Button>
							</Link>

							{/* Settings */}
							<Link href="/settings">
								<Button
									variant="ghost"
									size="icon"
									className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
								>
									<Settings className="w-5 h-5" />
								</Button>
							</Link>

							{/* User Menu */}
							<div className="flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-gray-700">
								<div className="text-right hidden xl:block">
									<div className="text-sm font-medium text-gray-900 dark:text-white">
										{session.user.name}
									</div>
									<div className="text-xs text-gray-500">
										{session.user.role}
									</div>
								</div>
								<div className="relative">
									{session.user.image ? (
										<Image
											src={session.user.image}
											alt={session.user.name || "User"}
											width={40}
											height={40}
											className="rounded-full border-2 border-gray-200 dark:border-gray-700"
										/>
									) : (
										<div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
											{session.user.name?.charAt(0).toUpperCase() || "U"}
										</div>
									)}
									<div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
								</div>
								<Button
									variant="ghost"
									size="icon"
									onClick={handleLogout}
									className="text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
								>
									<LogOut className="w-5 h-5" />
								</Button>
							</div>
						</>
					) : isVendorPortal && isVendorAuthenticated ? (
						<Button
							onClick={handleVendorLogout}
							className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-6 rounded-xl shadow-lg shadow-blue-500/25"
						>
							<LogOut className="w-4 h-4 mr-2" />
							Logout
						</Button>
					) : (
						<Link href="/login">
							<Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-6 rounded-xl shadow-lg shadow-blue-500/25">
								<User className="w-4 h-4 mr-2" />
								Login
							</Button>
						</Link>
					)}
				</div>

				{/* Mobile Menu */}
				<Sheet>
					<SheetTrigger
						className="lg:hidden"
						render={
							<Button variant="ghost" size="icon" className="text-gray-600">
								<Menu className="h-6 w-6" />
							</Button>
						}
					/>
					<SheetContent
						side="right"
						className="w-[85vw] sm:w-80 px-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-l border-gray-200/50 dark:border-gray-800/50 shrink-0 flex flex-col"
					>
						<SheetHeader className="px-6 pb-6 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
							<SheetTitle className="flex items-center gap-3">
								<div className="relative">
									<div className="absolute inset-0 bg-blue-500 blur-md opacity-20" />
									<Image
										src="/logo.png"
										alt="VVMV"
										width={240}
										height={80}
										style={{ width: 42, height: "auto" }}
										className="relative block"
									/>
								</div>
								<div className="text-left">
									{/* <div className="text-xl font-bold tracking-tight leading-none">
                    <span className="text-[#E31E24]">V</span>
                    <span className="text-[#0054A6]">V</span>
                    <span className="text-[#E31E24]">M</span>
                    <span className="text-[#0054A6]">V</span>
                  </div> */}
									<div className="text-[10px] uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 font-bold mt-1">
										transports
									</div>
								</div>
							</SheetTitle>
						</SheetHeader>

						{/* User Info (Mobile) */}
						{session?.user && (
							<div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 flex-shrink-0">
								<div className="flex items-center gap-4">
									<div className="relative">
										{session.user.image ? (
											<Image
												src={session.user.image}
												alt={session.user.name || "User"}
												width={52}
												height={52}
												className="rounded-2xl border-2 border-white dark:border-gray-700 shadow-md object-cover"
											/>
										) : (
											<div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
												{session.user.name?.charAt(0).toUpperCase() || "U"}
											</div>
										)}
										<div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
									</div>
									<div className="min-w-0">
										<div className="font-bold text-gray-900 dark:text-white truncate">
											{session.user.name}
										</div>
										<div className="text-xs text-gray-500 truncate mt-0.5">
											{session.user.email}
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Navigation Links (Mobile) - Scrollable */}
						<div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
							<div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-4 mb-3">
								Menu
							</div>
							{NAV_LINKS.map((link) => (
								<Link
									key={link.label}
									href={link.href}
									className={cn(
										"flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-semibold transition-all duration-300",
										pathname === link.href
											? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm"
											: "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50",
									)}
								>
									{link.icon && (
										<link.icon
											className={cn(
												"w-5 h-5",
												pathname === link.href
													? "text-blue-600"
													: "text-gray-400",
											)}
										/>
									)}
									{link.label}
									{pathname === link.href && (
										<ChevronRight className="ml-auto w-4 h-4 opacity-50" />
									)}
								</Link>
							))}

							{session?.user && (
								<>
									<div className="h-px bg-gray-100 dark:bg-gray-800 my-6 mx-4" />
									<div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-4 mb-3">
										Workspace
									</div>
									<Link
										href={isStaff ? "/internal/followup" : "/external/tracking"}
										className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all"
									>
										<Truck className="w-5 h-5 text-gray-400" />
										Dashboard
									</Link>
									<Link
										href="/settings"
										className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all"
									>
										<Settings className="w-5 h-5 text-gray-400" />
										Settings
									</Link>
								</>
							)}
						</div>

						{/* Bottom Actions (Mobile) */}
						<div className="flex-shrink-0 p-6 border-t border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
							{session?.user ? (
								<Button
									onClick={handleLogout}
									variant="ghost"
									className="w-full h-6 gap-3 text-red-500 font-bold rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-100 dark:hover:border-red-900/30 transition-all"
								>
									<LogOut className="w-5 h-5" />
									Sign Out
								</Button>
							) : isVendorPortal && isVendorAuthenticated ? (
								<Button
									onClick={handleVendorLogout}
									variant="ghost"
									className="w-full h-6 gap-3 text-red-500 font-bold rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-100 dark:hover:border-red-900/30 transition-all"
								>
									<LogOut className="w-5 h-5" />
									Logout
								</Button>
							) : (
								<Link href="/login" className="w-full block">
									<Button className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-2xl shadow-lg shadow-blue-500/25 font-bold">
										<User className="w-5 h-5 mr-3" />
										Login
									</Button>
								</Link>
							)}
						</div>
					</SheetContent>
				</Sheet>
			</nav>
		</header>
	);
}
