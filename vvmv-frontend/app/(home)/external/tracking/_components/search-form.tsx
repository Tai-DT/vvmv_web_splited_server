"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchFormProps {
	defaultValue?: string;
	onSearchStart?: () => void;
	searching?: boolean; // 👈 Nhận trạng thái từ cha
}

export function SearchForm({
	defaultValue = "",
	onSearchStart,
	searching = false,
}: SearchFormProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [orderCode, setOrderCode] = useState(defaultValue);

	const handleSearch = (e: FormEvent) => {
		e.preventDefault();

		const trimmed = orderCode.trim();
		if (!trimmed) return;

		const currentCode = searchParams.get("orderCode");
		if (currentCode === trimmed) {
			return; // Không search lại nếu trùng mã
		}

		onSearchStart?.(); // 👈 Chỉ thông báo cho cha
		router.push(`/external/tracking?orderCode=${encodeURIComponent(trimmed)}`);
	};

	return (
		<form onSubmit={handleSearch} className="flex items-center gap-4 flex-wrap">
			<div className="relative flex-1 min-w-[200px]">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<Input
					value={orderCode}
					onChange={(e) => setOrderCode(e.target.value)}
					placeholder="Nhập mã vận đơn"
					className="pl-10"
					disabled={searching} // 👈 Dùng searching từ cha
				/>
			</div>
			<Button type="submit" disabled={searching}>
				{searching ? ( // 👈 Dùng searching từ cha
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Đang tìm...
					</>
				) : (
					"Xem vận đơn"
				)}
			</Button>
		</form>
	);
}
