"use client";

import {
	ArrowRight,
	Eye,
	EyeOff,
	Globe,
	Lock,
	Package,
	Shield,
	Truck,
	User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { performCustomerLogin } from "@/lib/login-customer";

export default function LoginPage() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const handleGoogleSignIn = async () => {
		await authClient.signIn.social({
			provider: "google",
			callbackURL: "/settings",
		});
	};

	const handleCustomerSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const outcome = await performCustomerLogin(username, password, {
				signInUsername: authClient.signIn.username,
			});

			if (outcome.ok) {
				router.push(outcome.redirectTo);
				return;
			}

			setError("Invalid username or password");
		} catch (err) {
			console.error("[login]", err);
			setError(
				err instanceof Error ? err.message : "Something went wrong. Try again.",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex w-full">
			{/* Left Side - Branding */}
			<div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 relative overflow-hidden">
				{/* Background Pattern */}
				<div className="absolute inset-0 opacity-10">
					<div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
					<div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl" />
				</div>

				{/* Content */}
				<div className="relative z-10 flex flex-col justify-between p-12 w-full">
					{/* Logo */}
					<Link href="/" className="flex items-center gap-3">
						<Image
							src="/logo.png"
							alt="VVMV"
							width={240}
							height={80}
							style={{ width: 150, height: "auto" }}
						/>
					</Link>

					{/* Center Content */}
					<div className="flex-1 flex flex-col justify-center max-w-md">
						<h1 className="text-4xl font-bold text-white mb-6 leading-tight">
							Welcome to{" "}
							<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-200">
								VVMV Transports
							</span>
						</h1>
						<p className="text-xl text-blue-200 mb-12">
							Your trusted partner for seamless freight forwarding and supply
							chain solutions.
						</p>

						{/* Features */}
						<div className="space-y-4">
							{[
								{ icon: Globe, text: "Global Network in 50+ Countries" },
								{ icon: Package, text: "Real-time Shipment Tracking" },
								{ icon: Truck, text: "Door-to-door Delivery" },
								{ icon: Shield, text: "Secure & Reliable Service" },
							].map((feature, index) => (
								<div
									key={index}
									className="flex items-center gap-4 text-blue-100"
								>
									<div className="p-2 rounded-lg bg-white/10">
										<feature.icon className="w-5 h-5" />
									</div>
									<span>{feature.text}</span>
								</div>
							))}
						</div>
					</div>

					{/* Bottom */}
					<div className="text-blue-200 text-sm">
						© {new Date().getFullYear()} VVMV Transports. All rights reserved.
					</div>
				</div>
			</div>

			{/* Right Side - Login Forms */}
			<div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 lg:p-12">
				<div className="w-full max-w-md">
					{/* Mobile Logo */}
					<div className="lg:hidden flex justify-center mb-8">
						<Link href="/" className="flex items-center gap-3">
							<Image
								src="/logo.png"
								alt="VVMV"
								width={240}
								height={80}
								style={{ width: 60, height: "auto" }}
							/>
							<div>
								{/* <div className="text-2xl font-bold">
                  <span className="text-[#E31E24]">V</span>
                  <span className="text-[#0054A6]">V</span>
                  <span className="text-[#E31E24]">M</span>
                  <span className="text-[#0054A6]">V</span>
                </div> */}
								<div className="text-sm text-gray-500 tracking-wider">
									transports
								</div>
							</div>
						</Link>
					</div>

					{/* Login Header */}
					<div className="text-center mb-8">
						<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
							Sign in to your account
						</h2>
						<p className="text-gray-600 dark:text-gray-400">
							Access your dashboard and manage shipments
						</p>
					</div>

					{/* Staff Login (Google) */}
					<div className="mb-8">
						<div className="relative mb-6">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t border-gray-200 dark:border-gray-700" />
							</div>
							<div className="relative flex justify-center text-sm">
								<span className="px-4 bg-gray-50 dark:bg-gray-900 text-gray-500 font-medium">
									Staff Login
								</span>
							</div>
						</div>

						<Button
							type="button"
							onClick={handleGoogleSignIn}
							variant="outline"
							size="lg"
							className="w-full h-12 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl gap-3"
						>
							<svg className="w-5 h-5" viewBox="0 0 24 24">
								<path
									fill="#4285F4"
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								/>
								<path
									fill="#34A853"
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								/>
								<path
									fill="#FBBC05"
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								/>
								<path
									fill="#EA4335"
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								/>
							</svg>
							Sign in with Google
						</Button>
						<p className="text-xs text-gray-500 text-center mt-2">
							For @vvmv.com.vn email accounts
						</p>
					</div>

					{/* Divider */}
					<div className="relative mb-8">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-gray-200 dark:border-gray-700" />
						</div>
						<div className="relative flex justify-center text-sm">
							<span className="px-4 bg-gray-50 dark:bg-gray-900 text-gray-500 font-medium">
								Customer Login
							</span>
						</div>
					</div>

					{/* Customer Login Form */}
					<form onSubmit={handleCustomerSubmit} className="space-y-5">
						{error && !error.includes("@vvmv.com.vn") && (
							<div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
								{error}
							</div>
						)}

						<div>
							<label
								htmlFor="username"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
							>
								Username
							</label>
							<div className="relative">
								<div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
									<User className="w-5 h-5" />
								</div>
								<Input
									id="username"
									type="text"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									placeholder="Enter your username"
									className="h-12 pl-12 rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
									required
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor="password"
								className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
							>
								Password
							</label>
							<div className="relative">
								<div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
									<Lock className="w-5 h-5" />
								</div>
								<Input
									id="password"
									type={showPassword ? "text" : "password"}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Enter your password"
									className="h-12 pl-12 pr-12 rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
									required
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
								>
									{showPassword ? (
										<EyeOff className="h-5 w-5" />
									) : (
										<Eye className="h-5 w-5" />
									)}
								</button>
							</div>
						</div>

						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span className="text-sm text-gray-600 dark:text-gray-400">
								Remember me
							</span>
						</label>

						<Button
							type="submit"
							size="lg"
							disabled={loading}
							className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl shadow-lg shadow-blue-500/25"
						>
							{loading ? (
								<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
							) : (
								<>
									Sign in
									<ArrowRight className="ml-2 w-5 h-5" />
								</>
							)}
						</Button>
					</form>

					{/* Footer Links */}
					<div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
						<p className="mb-4">
							Need an account?{" "}
							<Link
								href="/contact"
								className="text-blue-600 hover:text-blue-700 font-medium"
							>
								Contact us
							</Link>
						</p>
						<Link
							href="/"
							className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
						>
							<ArrowRight className="w-4 h-4 rotate-180" />
							Back to home
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
