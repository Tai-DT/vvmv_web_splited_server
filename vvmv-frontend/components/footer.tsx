"use client";

import { Globe, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Footer() {
	const pathname = usePathname();
	const [isFocusModeQuery, setIsFocusModeQuery] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		setIsFocusModeQuery(params.get("focusTable") === "1");
	}, []);

	const isVendorTableFocusMode =
		pathname === "/vendor-portal" && isFocusModeQuery;

	if (isVendorTableFocusMode) {
		return null;
	}

	return (
		<footer className="bg-gray-900 py-12 border-t border-gray-800">
			<div className="max-w-7xl mx-auto px-6">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-8">
					<div className="col-span-1 md:col-span-2">
						<Link href="/" className="text-2xl font-bold mb-4 block">
							<span className="text-[#E31E24]">V</span>
							<span className="text-[#0054A6]">V</span>
							<span className="text-[#E31E24]">M</span>
							<span className="text-[#0054A6]">V</span>
							<span className="text-white ml-2">Transports</span>
						</Link>
						<p className="text-gray-400 mb-6 max-w-md">
							Delivering excellence in freight forwarding and supply chain
							solutions since 2007.
						</p>
						<div className="flex gap-4">
							<a
								href="/"
								target="_blank"
								rel="noopener noreferrer"
								className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
							>
								<Globe className="w-5 h-5" />
							</a>
							<Link
								href="/about"
								className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
							>
								<Users className="w-5 h-5" />
							</Link>
						</div>
					</div>

					<div>
						<h4 className="text-white font-semibold mb-4">Quick Links</h4>
						<ul className="space-y-2">
							{[
								{ label: "Services", href: "/services" },
								{ label: "About Us", href: "/about" },
								{ label: "Contact", href: "/contact" },
								{ label: "Tracking", href: "/external/tracking" },
							].map((link) => (
								<li key={link.label}>
									<Link
										href={link.href}
										className="text-gray-400 hover:text-white transition-colors"
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h4 className="text-white font-semibold mb-4">Locations</h4>
						<ul className="space-y-2">
							{[
								"Ho Chi Minh City (SGN)",
								"Ha Noi (HAN)",
								"Hai Phong (HPH)",
							].map((location) => (
								<li
									key={location}
									className="flex items-center gap-2 text-gray-400"
								>
									<MapPin className="w-4 h-4" />
									{location}
								</li>
							))}
						</ul>
					</div>
				</div>

				<div className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-500">
					© {new Date().getFullYear()} VVMV Transports. All rights reserved.
				</div>
			</div>
		</footer>
	);
}
