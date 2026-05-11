"use client";

import {
	AlertTriangle,
	CheckCircle2,
	ChevronRight,
	Circle,
	ClipboardPaste,
	Info,
	ListFilter,
	Palette,
	Pencil,
	Plus,
	Trash2,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
	type CreateFieldOptionPayload,
	type FieldOptionConditions,
	type FieldOptionWithUser,
	formatFieldOption,
	useAdminFieldOptions,
	useCreateFieldOption,
	useCreateFieldOptionsBulk,
	useDeleteFieldOption,
	useUpdateFieldOption,
} from "@/hooks/use-field-options";
import { useSession } from "@/lib/auth-client";

type Site = "SGN" | "HAN" | "DAD";

const SITE_OPTIONS: { value: Site | ""; label: string }[] = [
	{ value: "", label: "Tất cả site (Global)" },
	{ value: "SGN", label: "SGN - Hồ Chí Minh" },
	{ value: "HAN", label: "HAN - Hà Nội" },
	{ value: "DAD", label: "DAD - Đà Nẵng" },
];

const SITE_BADGE: Record<string, string> = {
	SGN: "bg-gradient-to-r from-red-500 to-orange-500 text-white",
	HAN: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
	DAD: "bg-gradient-to-r from-teal-500 to-cyan-500 text-white",
};

const PRESET_COLORS = [
	{ value: "default", label: "Mặc định" },
	{ value: "secondary", label: "Xám" },
	{ value: "success", label: "Xanh lá" },
	{ value: "warning", label: "Vàng" },
	{ value: "info", label: "Xanh dương" },
	{ value: "destructive", label: "Đỏ" },
];

function getColorMeta(color?: string | null) {
	switch (color) {
		case "success":
			return {
				icon: CheckCircle2,
				iconClassName: "text-emerald-600",
				label: "Xanh lá",
				badgeVariant: "success" as const,
			};
		case "warning":
			return {
				icon: AlertTriangle,
				iconClassName: "text-amber-500",
				label: "Vàng",
				badgeVariant: "warning" as const,
			};
		case "info":
			return {
				icon: Info,
				iconClassName: "text-blue-600",
				label: "Xanh dương",
				badgeVariant: "info" as const,
			};
		case "destructive":
			return {
				icon: XCircle,
				iconClassName: "text-red-600",
				label: "Đỏ",
				badgeVariant: "destructive" as const,
			};
		case "secondary":
			return {
				icon: Circle,
				iconClassName: "text-slate-500",
				label: "Xám",
				badgeVariant: "secondary" as const,
			};
		case "default":
			return {
				icon: Palette,
				iconClassName: "text-violet-600",
				label: "Mặc định",
				badgeVariant: "default" as const,
			};
		default:
			return {
				icon: Circle,
				iconClassName: "text-muted-foreground",
				label: "Không có màu",
				badgeVariant: "secondary" as const,
			};
	}
}

function ColorBadgePreview({ color }: { color?: string | null }) {
	const meta = getColorMeta(color);
	const Icon = meta.icon;

	return (
		<Badge variant={meta.badgeVariant} className="gap-1.5 text-xs">
			<Icon className={`size-3.5 ${meta.iconClassName}`} />
			{meta.label}
		</Badge>
	);
}

function parseConditionsInput(value: string): FieldOptionConditions | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const parsed = JSON.parse(trimmed);
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("Conditions phải là JSON object");
	}

	return parsed as FieldOptionConditions;
}

type BulkParsedRow = CreateFieldOptionPayload & {
	rowNumber: number;
};

function parseBulkExcelText(
	text: string,
	fieldName: string,
): { rows: BulkParsedRow[]; errors: string[] } {
	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	const rows: BulkParsedRow[] = [];
	const errors: string[] = [];

	lines.forEach((line, index) => {
		const columns = line.split("\t").map((value) => value.trim());
		const [
			codeOrName = "",
			second = "",
			color = "",
			conditionsRaw = "",
			orderRaw = "",
			siteRaw = "",
			activeRaw = "",
		] = columns;

		let code = "";
		let name = "";

		if (columns.length === 1) {
			name = codeOrName;
		} else {
			code = codeOrName;
			name = second;
		}

		if (!name) {
			errors.push(`Dòng ${index + 1}: thiếu Name`);
			return;
		}

		const normalizedSite = siteRaw.toUpperCase();
		if (normalizedSite && !["SGN", "HAN", "DAD"].includes(normalizedSite)) {
			errors.push(`Dòng ${index + 1}: Site phải là SGN, HAN hoặc DAD`);
			return;
		}

		const normalizedActive = activeRaw.toLowerCase();
		const isActive = ["", "1", "true", "yes", "active", "x"].includes(
			normalizedActive,
		);

		let conditions: FieldOptionConditions | null = null;
		if (conditionsRaw) {
			try {
				conditions = parseConditionsInput(conditionsRaw);
			} catch {
				errors.push(`Dòng ${index + 1}: Conditions JSON không hợp lệ`);
				return;
			}
		}

		rows.push({
			rowNumber: index + 1,
			fieldName,
			code: code || undefined,
			name,
			color: color || undefined,
			conditions,
			order: orderRaw ? Number(orderRaw) || 0 : index,
			site: normalizedSite || null,
			isActive,
		});
	});

	return { rows, errors };
}

interface BulkPasteDialogProps {
	open: boolean;
	onClose: () => void;
	fieldName: string;
}

function BulkPasteDialog({ open, onClose, fieldName }: BulkPasteDialogProps) {
	const [pasteText, setPasteText] = useState("");
	const bulkCreateMutation = useCreateFieldOptionsBulk();

	const { rows, errors } = parseBulkExcelText(pasteText, fieldName);

	const handlePaste = async () => {
		if (!fieldName) {
			toast.error("Hãy chọn field trước khi dán dữ liệu");
			return;
		}

		if (!pasteText.trim()) {
			toast.error("Chưa có dữ liệu để import");
			return;
		}

		if (errors.length > 0) {
			toast.error(errors[0]);
			return;
		}

		if (rows.length === 0) {
			toast.error("Không có dòng hợp lệ để tạo");
			return;
		}

		try {
			const result = await bulkCreateMutation.mutateAsync(rows);
			toast.success(`Đã tạo ${result.count} options cho field ${fieldName}`);
			setPasteText("");
			onClose();
		} catch (err: any) {
			toast.error(err.message);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>Dán từ Excel</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="rounded-lg border bg-muted/40 p-3 text-sm">
						<div className="font-medium">Field hiện tại: {fieldName}</div>
						<div className="mt-2 text-muted-foreground">
							Dán trực tiếp từ Excel theo thứ tự cột:
						</div>
						<div className="mt-1 font-mono text-xs text-muted-foreground">
							Code | Name | Color | Conditions JSON | Order | Site | Active
						</div>
						<div className="mt-1 text-xs text-muted-foreground">
							Nếu chỉ dán 1 cột thì hệ thống hiểu đó là Name. Giá trị lưu sẽ là
							Code nếu có, nếu không sẽ là Name.
						</div>
					</div>

					<Textarea
						value={pasteText}
						onChange={(e) => setPasteText(e.target.value)}
						placeholder={
							'A\tHóa đơn\tsuccess\t{"serviceMode":"AIR","operationType":"XUAT"}\t1\tSGN\ttrue\nB\tPhiếu đóng gói\tinfo\t{}\t2\tSGN\ttrue'
						}
						className="min-h-56 font-mono text-xs"
					/>

					<div className="grid gap-4 lg:grid-cols-2">
						<div className="rounded-lg border p-3">
							<div className="mb-2 text-sm font-medium">Preview</div>
							<div className="max-h-56 overflow-auto space-y-1 text-xs">
								{rows.length === 0 ? (
									<div className="text-muted-foreground">
										Chưa có dữ liệu hợp lệ
									</div>
								) : (
									rows.slice(0, 20).map((row) => (
										<div
											key={`${row.rowNumber}-${row.code ?? row.name}`}
											className="rounded bg-muted/40 px-2 py-1"
										>
											Dòng {row.rowNumber}:{" "}
											{row.code ? `${row.code} - ${row.name}` : row.name}
											{row.conditions &&
												Object.keys(row.conditions).length > 0 && (
													<span className="text-muted-foreground">
														{" "}
														• {JSON.stringify(row.conditions)}
													</span>
												)}
										</div>
									))
								)}
								{rows.length > 20 && (
									<div className="text-muted-foreground">
										... và {rows.length - 20} dòng nữa
									</div>
								)}
							</div>
						</div>

						<div className="rounded-lg border p-3">
							<div className="mb-2 text-sm font-medium">Kiểm tra lỗi</div>
							<div className="max-h-56 overflow-auto space-y-1 text-xs">
								{errors.length === 0 ? (
									<div className="text-emerald-600">Không có lỗi định dạng</div>
								) : (
									errors.map((error) => (
										<div
											key={error}
											className="rounded bg-red-50 px-2 py-1 text-red-600"
										>
											{error}
										</div>
									))
								)}
							</div>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={onClose}
						disabled={bulkCreateMutation.isPending}
					>
						Hủy
					</Button>
					<Button
						onClick={handlePaste}
						disabled={
							bulkCreateMutation.isPending ||
							rows.length === 0 ||
							errors.length > 0
						}
					>
						{bulkCreateMutation.isPending && (
							<Spinner className="mr-2 size-4" />
						)}
						Tạo {rows.length > 0 ? rows.length : ""} dòng
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Add / Edit Dialog ───────────────────────────────────────────────────────

interface OptionDialogProps {
	open: boolean;
	onClose: () => void;
	initial?: FieldOptionWithUser | null;
	defaultFieldName?: string;
}

function OptionDialog({
	open,
	onClose,
	initial,
	defaultFieldName = "",
}: OptionDialogProps) {
	const isEditing = !!initial;

	const [fieldName, setFieldName] = useState(
		initial?.fieldName ?? defaultFieldName,
	);
	const [code, setCode] = useState(initial?.code ?? "");
	const [name, setName] = useState(initial?.name ?? "");
	const [color, setColor] = useState(initial?.color ?? "");
	const [conditionsText, setConditionsText] = useState(
		initial?.conditions ? JSON.stringify(initial.conditions, null, 2) : "",
	);
	const [order, setOrder] = useState(String(initial?.order ?? 0));
	const [site, setSite] = useState<Site | "">(
		(initial?.site as Site | null) ?? "",
	);
	const [isActive, setIsActive] = useState(initial?.isActive ?? true);

	const createMutation = useCreateFieldOption();
	const updateMutation = useUpdateFieldOption();
	const isPending = createMutation.isPending || updateMutation.isPending;

	const preview = code ? `${code} - ${name}` : name;

	const handleSubmit = async () => {
		if (!fieldName.trim() || !name.trim()) {
			toast.error("Field Name và Name là bắt buộc");
			return;
		}

		let parsedConditions: FieldOptionConditions | null = null;
		try {
			parsedConditions = parseConditionsInput(conditionsText);
		} catch (error: any) {
			toast.error(error.message || "Conditions JSON không hợp lệ");
			return;
		}

		const payload: CreateFieldOptionPayload = {
			fieldName: fieldName.trim(),
			code: code.trim() || undefined,
			name: name.trim(),
			color: color || undefined,
			conditions: parsedConditions,
			order: parseInt(order, 10) || 0,
			site: site || null,
			isActive,
		};

		try {
			if (isEditing && initial) {
				await updateMutation.mutateAsync({ id: initial.id, ...payload });
				toast.success("Cập nhật option thành công");
			} else {
				await createMutation.mutateAsync(payload);
				toast.success("Thêm option thành công");
			}
			onClose();
		} catch (err: any) {
			toast.error(err.message);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Chỉnh sửa Option" : "Thêm Option mới"}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{/* Field Name */}
					<div className="space-y-1">
						<label className="text-sm font-medium">
							Field Name <span className="text-red-500">*</span>
						</label>
						<Input
							value={fieldName}
							onChange={(e) => setFieldName(e.target.value)}
							placeholder="vd: invoiceType, customsMethod"
							disabled={isEditing}
						/>
						<p className="text-xs text-muted-foreground">
							Tên field trong code, không thay đổi sau khi tạo
						</p>
					</div>

					{/* Code + Name */}
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1">
							<label className="text-sm font-medium">Code</label>
							<Input
								value={code}
								onChange={(e) => setCode(e.target.value)}
								placeholder="vd: A, B, C"
							/>
							<p className="text-xs text-muted-foreground">
								Giá trị lưu vào DB
							</p>
						</div>
						<div className="space-y-1">
							<label className="text-sm font-medium">
								Name <span className="text-red-500">*</span>
							</label>
							<Input
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="vd: Hóa đơn"
							/>
							<p className="text-xs text-muted-foreground">Tên hiển thị</p>
						</div>
					</div>

					<div className="space-y-1">
						<label className="text-sm font-medium">Điều kiện hiển thị</label>
						<Textarea
							value={conditionsText}
							onChange={(e) => setConditionsText(e.target.value)}
							placeholder={
								'{\n  "serviceMode": "AIR",\n  "operationType": "XUAT"\n}'
							}
							className="min-h-28 font-mono text-xs"
						/>
						<div className="rounded-md border bg-muted/40 p-2.5 text-xs space-y-1.5 font-mono">
							<p className="font-sans font-medium text-foreground not-italic">
								Cú pháp điều kiện:
							</p>
							<p>
								<span className="text-blue-600 select-all">{`{ "field": "value" }`}</span>{" "}
								— bằng
							</p>
							<p>
								<span className="text-blue-600 select-all">{`{ "field": ["A","B"] }`}</span>{" "}
								— OR (bất kỳ)
							</p>
							<p>
								<span className="text-blue-600 select-all">{`{ "field": { "$like": "FC" } }`}</span>{" "}
								— chứa
							</p>
							<p>
								<span className="text-blue-600 select-all">{`{ "field": { "$startsWith": "FC" } }`}</span>{" "}
								— bắt đầu bằng
							</p>
							<p>
								<span className="text-blue-600 select-all">{`{ "field": { "$endsWith": "L" } }`}</span>{" "}
								— kết thúc bằng
							</p>
							<p>
								<span className="text-blue-600 select-all">{`{ "field": { "$not": "X" } }`}</span>{" "}
								— khác
							</p>
							<p>
								<span className="text-blue-600 select-all">{`{ "$or": [{"f":"A"},{"f":"B"}] }`}</span>{" "}
								— OR nhiều điều kiện
							</p>
							<p className="font-sans text-muted-foreground not-italic">
								Nhiều key ngoài cùng → AND. Để trống → luôn hiển thị.
							</p>
						</div>
					</div>

					{/* Preview */}
					{(code || name) && (
						<div className="rounded-md bg-muted px-3 py-2 text-sm">
							<span className="text-muted-foreground">Hiển thị: </span>
							<span className="font-medium">{preview || "—"}</span>
							{code && (
								<>
									<span className="text-muted-foreground ml-2">• Lưu: </span>
									<span className="font-mono text-xs">{code}</span>
								</>
							)}
						</div>
					)}

					{/* Color + Order */}
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1">
							<label className="text-sm font-medium">Màu badge</label>
							<Select
								value={color}
								onValueChange={(val) => setColor(val as string)}
							>
								<SelectTrigger>
									<SelectValue placeholder="Không có màu" />
								</SelectTrigger>
								<SelectPositioner>
									<SelectContent>
										<SelectItem value="">
											<div className="flex items-center gap-2">
												<Circle className="size-3.5 text-muted-foreground" />
												<span>Không có màu</span>
											</div>
										</SelectItem>
										{PRESET_COLORS.map((c) => (
											<SelectItem key={c.value} value={c.value}>
												<div className="flex items-center gap-2">
													{(() => {
														const Icon = getColorMeta(c.value).icon;
														return (
															<Icon
																className={`size-3.5 ${getColorMeta(c.value).iconClassName}`}
															/>
														);
													})()}
													<span>{c.label}</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</SelectPositioner>
							</Select>
							<div className="pt-2">
								<ColorBadgePreview color={color} />
							</div>
						</div>
						<div className="space-y-1">
							<label className="text-sm font-medium">Thứ tự</label>
							<Input
								type="number"
								value={order}
								onChange={(e) => setOrder(e.target.value)}
								min={0}
							/>
						</div>
					</div>

					{/* Site scope */}
					<div className="space-y-1">
						<label className="text-sm font-medium">Phạm vi Site</label>
						<Select
							value={site}
							onValueChange={(v) =>
								setSite(v as Site | "" | unknown as Site | "")
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Chọn site" />
							</SelectTrigger>
							<SelectPositioner>
								<SelectContent>
									{SITE_OPTIONS.map((s) => (
										<SelectItem key={s.value} value={s.value}>
											{s.label}
										</SelectItem>
									))}
								</SelectContent>
							</SelectPositioner>
						</Select>
					</div>

					{/* Active toggle */}
					<div className="flex items-center gap-2">
						<input
							type="checkbox"
							id="isActive"
							checked={isActive}
							onChange={(e) => setIsActive(e.target.checked)}
							className="h-4 w-4 rounded border-gray-300"
						/>
						<label htmlFor="isActive" className="text-sm font-medium">
							Kích hoạt
						</label>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={isPending}>
						Hủy
					</Button>
					<Button onClick={handleSubmit} disabled={isPending}>
						{isPending && <Spinner className="mr-2 size-4" />}
						{isEditing ? "Lưu thay đổi" : "Thêm option"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function FieldOptionsManagement() {
	const { data: session } = useSession();
	const [selectedField, setSelectedField] = useState<string | null>(null);
	const [newFieldName, setNewFieldName] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<FieldOptionWithUser | null>(
		null,
	);
	const [deleteTarget, setDeleteTarget] = useState<FieldOptionWithUser | null>(
		null,
	);

	const isAdmin =
		session?.user?.role === "ADMIN" || session?.user?.role === "SUPERADMIN";

	// Fetch all field names + options for selected field
	const { items, fieldNames, isLoading } = useAdminFieldOptions(
		selectedField ?? undefined,
	);

	const deleteMutation = useDeleteFieldOption();

	const handleDelete = async () => {
		if (!deleteTarget) return;
		try {
			await deleteMutation.mutateAsync(deleteTarget.id);
			toast.success("Đã xóa option");
			setDeleteTarget(null);
		} catch (err: any) {
			toast.error(err.message);
		}
	};

	const handleOpenAdd = () => {
		setEditTarget(null);
		setDialogOpen(true);
	};

	const handleOpenEdit = (item: FieldOptionWithUser) => {
		setEditTarget(item);
		setDialogOpen(true);
	};

	const handleDialogClose = () => {
		setDialogOpen(false);
		setEditTarget(null);
	};

	if (!isAdmin) {
		return (
			<div className="p-6 text-center text-muted-foreground">
				Bạn không có quyền truy cập trang này.
			</div>
		);
	}

	return (
		<div className="flex gap-4 min-h-[500px]">
			{/* ── Sidebar: field list ── */}
			<div className="w-56 shrink-0 border rounded-lg overflow-hidden">
				<div className="bg-muted px-3 py-2 border-b">
					<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
						Field Names
					</p>
				</div>

				{/* Add new field name */}
				<div className="p-2 border-b flex gap-1">
					<Input
						value={newFieldName}
						onChange={(e) => setNewFieldName(e.target.value)}
						placeholder="Tên field mới…"
						className="h-7 text-xs"
						onKeyDown={(e) => {
							if (e.key === "Enter" && newFieldName.trim()) {
								setSelectedField(newFieldName.trim());
								setNewFieldName("");
							}
						}}
					/>
					<Button
						size="sm"
						variant="outline"
						className="h-7 px-2"
						onClick={() => {
							if (newFieldName.trim()) {
								setSelectedField(newFieldName.trim());
								setNewFieldName("");
							}
						}}
						disabled={!newFieldName.trim()}
					>
						<Plus className="size-3" />
					</Button>
				</div>

				{isLoading && !selectedField ? (
					<div className="flex justify-center p-4">
						<Spinner className="size-5" />
					</div>
				) : (
					<ul className="py-1">
						{fieldNames.map((fn) => (
							<li key={fn}>
								<button
									className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-accent transition-colors ${
										selectedField === fn
											? "bg-accent font-medium text-accent-foreground"
											: "text-foreground"
									}`}
									onClick={() => setSelectedField(fn)}
								>
									<span className="truncate">{fn}</span>
									{selectedField === fn && (
										<ChevronRight className="size-3 shrink-0 text-muted-foreground" />
									)}
								</button>
							</li>
						))}
						{fieldNames.length === 0 && !isLoading && (
							<li className="px-3 py-4 text-xs text-center text-muted-foreground">
								Chưa có field nào
							</li>
						)}
					</ul>
				)}
			</div>

			{/* ── Main panel: options table ── */}
			<div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 bg-muted border-b">
					<div className="flex items-center gap-2">
						<ListFilter className="size-4 text-muted-foreground" />
						<span className="text-sm font-medium">
							{selectedField ? (
								<>
									Options cho{" "}
									<code className="bg-background px-1 py-0.5 rounded text-xs">
										{selectedField}
									</code>
								</>
							) : (
								"Chọn một field từ danh sách bên trái"
							)}
						</span>
						{selectedField && (
							<Badge variant="secondary" className="text-xs">
								{items.length} options
							</Badge>
						)}
					</div>

					{selectedField && (
						<div className="flex items-center gap-2">
							<Button
								size="sm"
								variant="outline"
								onClick={() => setBulkDialogOpen(true)}
							>
								<ClipboardPaste className="size-3.5 mr-1" />
								Dán từ Excel
							</Button>
							<Button size="sm" onClick={handleOpenAdd}>
								<Plus className="size-3.5 mr-1" />
								Thêm option
							</Button>
						</div>
					)}
				</div>

				{/* Content */}
				{!selectedField ? (
					<div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2">
						<ListFilter className="size-10 opacity-30" />
						<p className="text-sm">Chọn field để xem và quản lý options</p>
					</div>
				) : isLoading ? (
					<div className="flex justify-center items-center flex-1">
						<Spinner className="size-6" />
					</div>
				) : items.length === 0 ? (
					<div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
						<p className="text-sm">Chưa có option nào cho field này</p>
						<Button size="sm" variant="outline" onClick={handleOpenAdd}>
							<Plus className="size-3.5 mr-1" />
							Thêm option đầu tiên
						</Button>
					</div>
				) : (
					<div className="overflow-auto flex-1">
						<table className="w-full text-sm">
							<thead className="bg-muted/50 sticky top-0">
								<tr>
									<th className="text-left px-4 py-2 font-medium text-muted-foreground w-8">
										#
									</th>
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">
										Hiển thị
									</th>
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">
										Code (lưu DB)
									</th>
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">
										Name
									</th>
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">
										Màu
									</th>
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">
										Điều kiện
									</th>
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">
										Site
									</th>
									<th className="text-left px-4 py-2 font-medium text-muted-foreground">
										Trạng thái
									</th>
									<th className="text-right px-4 py-2 font-medium text-muted-foreground">
										Thao tác
									</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{items.map((item, idx) => (
									<tr
										key={item.id}
										className="hover:bg-muted/30 transition-colors"
									>
										<td className="px-4 py-2.5 text-xs text-muted-foreground">
											{item.order || idx + 1}
										</td>
										<td className="px-4 py-2.5 font-medium">
											{formatFieldOption(item)}
										</td>
										<td className="px-4 py-2.5">
											{item.code ? (
												<code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
													{item.code}
												</code>
											) : (
												<span className="text-muted-foreground text-xs">—</span>
											)}
										</td>
										<td className="px-4 py-2.5 text-muted-foreground text-xs">
											{item.name}
										</td>
										<td className="px-4 py-2.5">
											{item.color ? (
												<ColorBadgePreview color={item.color} />
											) : (
												<ColorBadgePreview color={null} />
											)}
										</td>
										<td className="px-4 py-2.5 text-xs text-muted-foreground">
											{item.conditions ? (
												<pre className="max-w-72 overflow-auto whitespace-pre-wrap rounded bg-muted/40 px-2 py-1 font-mono text-[11px] leading-4">
													{JSON.stringify(item.conditions, null, 2)}
												</pre>
											) : (
												<span>—</span>
											)}
										</td>
										<td className="px-4 py-2.5">
											{item.site ? (
												<span
													className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${SITE_BADGE[item.site] || "bg-gray-100 text-gray-700"}`}
												>
													{item.site}
												</span>
											) : (
												<span className="text-xs text-muted-foreground">
													Global
												</span>
											)}
										</td>
										<td className="px-4 py-2.5">
											<Badge
												variant={item.isActive ? "success" : "secondary"}
												className="text-xs"
											>
												{item.isActive ? "Active" : "Inactive"}
											</Badge>
										</td>
										<td className="px-4 py-2.5 text-right">
											<div className="flex items-center justify-end gap-1">
												<Button
													size="sm"
													variant="ghost"
													className="h-7 w-7 p-0"
													onClick={() => handleOpenEdit(item)}
												>
													<Pencil className="size-3.5" />
												</Button>
												<Button
													size="sm"
													variant="ghost"
													className="h-7 w-7 p-0 text-destructive hover:text-destructive"
													onClick={() => setDeleteTarget(item)}
												>
													<Trash2 className="size-3.5" />
												</Button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* ── Add/Edit Dialog ── */}
			{dialogOpen && (
				<OptionDialog
					open={dialogOpen}
					onClose={handleDialogClose}
					initial={editTarget}
					defaultFieldName={selectedField ?? ""}
				/>
			)}

			{bulkDialogOpen && selectedField && (
				<BulkPasteDialog
					open={bulkDialogOpen}
					onClose={() => setBulkDialogOpen(false)}
					fieldName={selectedField}
				/>
			)}

			{/* ── Delete Confirm Dialog ── */}
			<Dialog
				open={!!deleteTarget}
				onOpenChange={(v) => !v && setDeleteTarget(null)}
			>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Xác nhận xóa</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted-foreground">
						Xóa option{" "}
						<strong>
							{deleteTarget ? formatFieldOption(deleteTarget) : ""}
						</strong>
						? Hành động này không thể hoàn tác.
					</p>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteTarget(null)}
							disabled={deleteMutation.isPending}
						>
							Hủy
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending && <Spinner className="mr-2 size-4" />}
							Xóa
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
