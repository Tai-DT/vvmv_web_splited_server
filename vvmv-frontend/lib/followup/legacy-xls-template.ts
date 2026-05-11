import * as XLSX from "xlsx";

export type LegacyTemplateCellValue =
	| string
	| number
	| boolean
	| null
	| undefined;

export type LegacyTemplateSheetPatch = {
	originRow: number;
	originCol?: number;
	rows: LegacyTemplateCellValue[][];
};

type BiffRecord = {
	type: number;
	start: number;
	end: number;
	payload: Buffer;
};

type BoundSheetInfo = {
	name: string;
	bofPosition: number;
	recordStart: number;
};

type ParsedCellInfo = {
	row: number;
	col: number;
	xf: number;
	hadCell: boolean;
	blank: boolean;
};

type ParsedSheetCellTable = {
	rowRecords: Map<number, Buffer>;
	rawRecordsByRow: Map<number, Buffer[]>;
	rowFallbackXfs: Map<number, number>;
	colFallbackXfs: Map<number, number>;
	cells: Map<string, ParsedCellInfo>;
};

type FinalCellInfo = {
	row: number;
	col: number;
	xf: number;
	hadCell: boolean;
	value: LegacyTemplateCellValue;
};

const BIFF_RECORD_TYPES = {
	BOUNDSHEET: 0x0085,
	EOF: 0x000a,
	ROW: 0x0208,
	DIMENSIONS: 0x0200,
	WINDOW2: 0x023e,
	BLANK: 0x0201,
	NUMBER: 0x0203,
	LABEL: 0x0204,
	BOOLERR: 0x0205,
	LABEL_SST: 0x00fd,
	MULRK: 0x00bd,
	MULBLANK: 0x00be,
	RK: 0x027e,
} as const;

function cellKey(row: number, col: number) {
	return `${row}:${col}`;
}

function isBlankValue(value: LegacyTemplateCellValue) {
	return value === null || value === undefined || value === "";
}

function readBiffRecords(buffer: Buffer, start = 0, end = buffer.length) {
	const records: BiffRecord[] = [];
	let offset = start;

	while (offset + 4 <= end) {
		const type = buffer.readUInt16LE(offset);
		const length = buffer.readUInt16LE(offset + 2);
		const recordEnd = offset + 4 + length;

		if (recordEnd > end) {
			break;
		}

		records.push({
			type,
			start: offset,
			end: recordEnd,
			payload: buffer.subarray(offset + 4, recordEnd),
		});

		offset = recordEnd;
	}

	return records;
}

function readShortUnicodeString(buffer: Buffer, offset: number) {
	const length = buffer.readUInt8(offset);
	let cursor = offset + 1;
	const flags = buffer.readUInt8(cursor);
	cursor += 1;

	let richTextRuns = 0;
	let extendedSize = 0;

	if (flags & 0x08) {
		richTextRuns = buffer.readUInt16LE(cursor);
		cursor += 2;
	}

	if (flags & 0x04) {
		extendedSize = buffer.readUInt32LE(cursor);
		cursor += 4;
	}

	const wide = (flags & 0x01) !== 0;
	const byteLength = wide ? length * 2 : length;
	const value = buffer.toString(
		wide ? "utf16le" : "latin1",
		cursor,
		cursor + byteLength,
	);

	return {
		value,
		nextOffset: cursor + byteLength + richTextRuns * 4 + extendedSize,
	};
}

function collectBoundSheets(workbookBuffer: Buffer) {
	const records = readBiffRecords(workbookBuffer);
	const sheets: BoundSheetInfo[] = [];

	for (const record of records) {
		if (record.type !== BIFF_RECORD_TYPES.BOUNDSHEET) {
			continue;
		}

		sheets.push({
			name: readShortUnicodeString(record.payload, 6).value,
			bofPosition: record.payload.readUInt32LE(0),
			recordStart: record.start,
		});
	}

	return sheets.sort((left, right) => left.bofPosition - right.bofPosition);
}

function parseSheetCellTable(tableBuffer: Buffer) {
	const rowRecords = new Map<number, Buffer>();
	const rawRecordsByRow = new Map<number, Buffer[]>();
	const rowFallbackXfs = new Map<number, number>();
	const colFallbackXfs = new Map<number, number>();
	const cells = new Map<string, ParsedCellInfo>();

	const rememberCell = (
		row: number,
		col: number,
		xf: number,
		blank: boolean,
	) => {
		const key = cellKey(row, col);
		cells.set(key, {
			row,
			col,
			xf,
			hadCell: true,
			blank,
		});

		if (!rowFallbackXfs.has(row)) {
			rowFallbackXfs.set(row, xf);
		}

		if (!colFallbackXfs.has(col)) {
			colFallbackXfs.set(col, xf);
		}
	};

	const rememberRawRecord = (row: number, record: Buffer) => {
		if (!rawRecordsByRow.has(row)) {
			rawRecordsByRow.set(row, []);
		}
		rawRecordsByRow.get(row)?.push(record);
	};

	for (const record of readBiffRecords(tableBuffer)) {
		const payload = record.payload;
		const rawRecord = Buffer.from(
			tableBuffer.subarray(record.start, record.end),
		);

		switch (record.type) {
			case BIFF_RECORD_TYPES.ROW: {
				const row = payload.readUInt16LE(0);
				rowRecords.set(row, rawRecord);
				rememberRawRecord(row, rawRecord);
				break;
			}
			case BIFF_RECORD_TYPES.BLANK: {
				rememberRawRecord(payload.readUInt16LE(0), rawRecord);
				rememberCell(
					payload.readUInt16LE(0),
					payload.readUInt16LE(2),
					payload.readUInt16LE(4),
					true,
				);
				break;
			}
			case BIFF_RECORD_TYPES.NUMBER:
			case BIFF_RECORD_TYPES.LABEL:
			case BIFF_RECORD_TYPES.BOOLERR:
			case BIFF_RECORD_TYPES.LABEL_SST:
			case BIFF_RECORD_TYPES.RK: {
				rememberRawRecord(payload.readUInt16LE(0), rawRecord);
				rememberCell(
					payload.readUInt16LE(0),
					payload.readUInt16LE(2),
					payload.readUInt16LE(4),
					false,
				);
				break;
			}
			case BIFF_RECORD_TYPES.MULBLANK: {
				const row = payload.readUInt16LE(0);
				rememberRawRecord(row, rawRecord);
				const firstCol = payload.readUInt16LE(2);
				const lastCol = payload.readUInt16LE(payload.length - 2);

				for (let col = firstCol, cursor = 4; col <= lastCol; col += 1) {
					rememberCell(row, col, payload.readUInt16LE(cursor), true);
					cursor += 2;
				}
				break;
			}
			case BIFF_RECORD_TYPES.MULRK: {
				const row = payload.readUInt16LE(0);
				rememberRawRecord(row, rawRecord);
				const firstCol = payload.readUInt16LE(2);
				const lastCol = payload.readUInt16LE(payload.length - 2);

				for (let col = firstCol, cursor = 4; col <= lastCol; col += 1) {
					rememberCell(row, col, payload.readUInt16LE(cursor), false);
					cursor += 6;
				}
				break;
			}
			default:
				break;
		}
	}

	return {
		rowRecords,
		rawRecordsByRow,
		rowFallbackXfs,
		colFallbackXfs,
		cells,
	} satisfies ParsedSheetCellTable;
}

function encodeBiffRecord(type: number, payload: Buffer) {
	const record = Buffer.alloc(4 + payload.length);
	record.writeUInt16LE(type, 0);
	record.writeUInt16LE(payload.length, 2);
	payload.copy(record, 4);
	return record;
}

function encodeCellHeader(row: number, col: number, xf: number) {
	const payload = Buffer.alloc(6);
	payload.writeUInt16LE(row, 0);
	payload.writeUInt16LE(col, 2);
	payload.writeUInt16LE(xf, 4);
	return payload;
}

function encodeBlankCell(row: number, col: number, xf: number) {
	return encodeBiffRecord(
		BIFF_RECORD_TYPES.BLANK,
		encodeCellHeader(row, col, xf),
	);
}

function encodeNumberCell(row: number, col: number, xf: number, value: number) {
	const payload = Buffer.alloc(14);
	encodeCellHeader(row, col, xf).copy(payload, 0);
	payload.writeDoubleLE(value, 6);
	return encodeBiffRecord(BIFF_RECORD_TYPES.NUMBER, payload);
}

function encodeBooleanCell(
	row: number,
	col: number,
	xf: number,
	value: boolean,
) {
	const payload = Buffer.alloc(8);
	encodeCellHeader(row, col, xf).copy(payload, 0);
	payload.writeUInt8(value ? 1 : 0, 6);
	payload.writeUInt8(0, 7);
	return encodeBiffRecord(BIFF_RECORD_TYPES.BOOLERR, payload);
}

function encodeLabelCell(row: number, col: number, xf: number, value: string) {
	const text = String(value);
	const textBytes = Buffer.from(text, "utf16le");
	const payload = Buffer.alloc(6 + 2 + 1 + textBytes.length);
	encodeCellHeader(row, col, xf).copy(payload, 0);
	payload.writeUInt16LE(text.length, 6);
	payload.writeUInt8(1, 8);
	textBytes.copy(payload, 9);
	return encodeBiffRecord(BIFF_RECORD_TYPES.LABEL, payload);
}

function encodeDimensionsRecord(range: XLSX.Range) {
	const payload = Buffer.alloc(14);
	payload.writeUInt32LE(range.s.r, 0);
	payload.writeUInt32LE(range.e.r + 1, 4);
	payload.writeUInt16LE(range.s.c, 8);
	payload.writeUInt16LE(range.e.c + 1, 10);
	payload.writeUInt16LE(0, 12);
	return encodeBiffRecord(BIFF_RECORD_TYPES.DIMENSIONS, payload);
}

function resolveFallbackXf(
	row: number,
	col: number,
	parsedTable: ParsedSheetCellTable,
) {
	const rowXf = parsedTable.rowFallbackXfs.get(row);
	if (rowXf !== undefined) {
		return rowXf;
	}

	const colXf = parsedTable.colFallbackXfs.get(col);
	if (colXf !== undefined) {
		return colXf;
	}

	const nearestRow = [...parsedTable.rowFallbackXfs.keys()].sort(
		(left, right) => Math.abs(left - row) - Math.abs(right - row),
	)[0];
	if (nearestRow !== undefined) {
		return parsedTable.rowFallbackXfs.get(nearestRow) ?? 0;
	}

	const nearestCol = [...parsedTable.colFallbackXfs.keys()].sort(
		(left, right) => Math.abs(left - col) - Math.abs(right - col),
	)[0];
	if (nearestCol !== undefined) {
		return parsedTable.colFallbackXfs.get(nearestCol) ?? 0;
	}

	return 0;
}

function cloneRowRecord(record: Buffer, row: number) {
	const cloned = Buffer.from(record);
	cloned.writeUInt16LE(row, 4);
	return cloned;
}

function buildFinalCells(
	sheet: XLSX.WorkSheet,
	patch: LegacyTemplateSheetPatch,
	parsedTable: ParsedSheetCellTable,
) {
	const finalCells = new Map<string, FinalCellInfo>();

	for (const existingCell of parsedTable.cells.values()) {
		const address = XLSX.utils.encode_cell({
			r: existingCell.row,
			c: existingCell.col,
		});
		finalCells.set(cellKey(existingCell.row, existingCell.col), {
			row: existingCell.row,
			col: existingCell.col,
			xf: existingCell.xf,
			hadCell: true,
			value: sheet[address]?.v,
		});
	}

	const originCol = (patch.originCol ?? 1) - 1;

	patch.rows.forEach((rowValues, rowOffset) => {
		rowValues.forEach((value, colOffset) => {
			const row = patch.originRow - 1 + rowOffset;
			const col = originCol + colOffset;
			const key = cellKey(row, col);
			const existingCell = finalCells.get(key);

			if (isBlankValue(value) && !existingCell?.hadCell) {
				return;
			}

			finalCells.set(key, {
				row,
				col,
				xf: existingCell?.xf ?? resolveFallbackXf(row, col, parsedTable),
				hadCell: existingCell?.hadCell ?? false,
				value,
			});
		});
	});

	return finalCells;
}

function buildPatchedCellTable(
	sheet: XLSX.WorkSheet,
	patch: LegacyTemplateSheetPatch,
	parsedTable: ParsedSheetCellTable,
	templateRange: XLSX.Range,
) {
	const finalCells = buildFinalCells(sheet, patch, parsedTable);
	const rowsByIndex = new Map<number, FinalCellInfo[]>();
	const patchedRows = new Set<number>();
	let maxRow = templateRange.e.r;
	let maxCol = templateRange.e.c;

	patch.rows.forEach((_, rowOffset) => {
		patchedRows.add(patch.originRow - 1 + rowOffset);
	});

	for (const cell of finalCells.values()) {
		const shouldEmitBlank = isBlankValue(cell.value) && cell.hadCell;
		const shouldEmitValue = !isBlankValue(cell.value);

		if (!shouldEmitBlank && !shouldEmitValue) {
			continue;
		}

		if (!rowsByIndex.has(cell.row)) {
			rowsByIndex.set(cell.row, []);
		}

		rowsByIndex.get(cell.row)?.push(cell);
		maxRow = Math.max(maxRow, cell.row);
		maxCol = Math.max(maxCol, cell.col);
	}

	const parts: Buffer[] = [];
	const sortedRows = new Set<number>([
		...parsedTable.rawRecordsByRow.keys(),
		...rowsByIndex.keys(),
	]);
	const orderedRows = [...sortedRows].sort((left, right) => left - right);
	const rowRecordSource =
		parsedTable.rowRecords.get(templateRange.e.r) ??
		parsedTable.rowRecords.get(templateRange.e.r - 1) ??
		parsedTable.rowRecords.values().next().value ??
		null;

	for (const row of orderedRows) {
		if (!patchedRows.has(row) && row <= templateRange.e.r) {
			const rawRecords = parsedTable.rawRecordsByRow.get(row);
			if (rawRecords) {
				parts.push(...rawRecords);
			}
			continue;
		}

		const rowRecord =
			parsedTable.rowRecords.get(row) ??
			(rowRecordSource && row > templateRange.e.r
				? cloneRowRecord(rowRecordSource, row)
				: null);

		if (rowRecord) {
			parts.push(rowRecord);
		}

		const rowCells = rowsByIndex.get(row);
		if (!rowCells) {
			continue;
		}

		rowCells.sort((left, right) => left.col - right.col);

		for (const cell of rowCells) {
			if (isBlankValue(cell.value)) {
				parts.push(encodeBlankCell(cell.row, cell.col, cell.xf));
				continue;
			}

			if (typeof cell.value === "number") {
				parts.push(encodeNumberCell(cell.row, cell.col, cell.xf, cell.value));
				continue;
			}

			if (typeof cell.value === "boolean") {
				parts.push(encodeBooleanCell(cell.row, cell.col, cell.xf, cell.value));
				continue;
			}

			parts.push(
				encodeLabelCell(cell.row, cell.col, cell.xf, String(cell.value)),
			);
		}
	}

	return {
		cellTable: Buffer.concat(parts),
		range: {
			s: { r: templateRange.s.r, c: templateRange.s.c },
			e: { r: maxRow, c: maxCol },
		} satisfies XLSX.Range,
	};
}

function patchSheetSubstream(
	sheetBuffer: Buffer,
	sheet: XLSX.WorkSheet,
	patch: LegacyTemplateSheetPatch,
) {
	const records = readBiffRecords(sheetBuffer);
	const dimensionsRecord = records.find(
		(record) => record.type === BIFF_RECORD_TYPES.DIMENSIONS,
	);
	const windowRecord = records.find(
		(record) => record.type === BIFF_RECORD_TYPES.WINDOW2,
	);

	if (!dimensionsRecord || !windowRecord) {
		throw new Error(
			"Legacy XLS template is missing BIFF8 dimensions/window records",
		);
	}

	const templateRange = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
	const tableBuffer = sheetBuffer.subarray(
		dimensionsRecord.end,
		windowRecord.start,
	);
	const parsedTable = parseSheetCellTable(tableBuffer);
	const patchedCellTable = buildPatchedCellTable(
		sheet,
		patch,
		parsedTable,
		templateRange,
	);

	return Buffer.concat([
		sheetBuffer.subarray(0, dimensionsRecord.start),
		encodeDimensionsRecord(patchedCellTable.range),
		patchedCellTable.cellTable,
		sheetBuffer.subarray(windowRecord.start),
	]);
}

export function writeLegacyTemplateWorkbook(
	templateBuffer: Buffer,
	workbook: XLSX.WorkBook,
	sheetPatches: Record<string, LegacyTemplateSheetPatch>,
) {
	const cfb = XLSX.CFB.read(templateBuffer, { type: "buffer" });
	const workbookEntry =
		cfb.FileIndex.find(
			(entry: { name?: string }) => entry.name === "Workbook",
		) ??
		cfb.FileIndex.find((entry: { name?: string }) => entry.name === "Book");

	if (!workbookEntry?.content) {
		throw new Error("Workbook stream not found in legacy XLS template");
	}

	const originalWorkbookBuffer = Buffer.from(workbookEntry.content);
	const boundSheets = collectBoundSheets(originalWorkbookBuffer);

	if (boundSheets.length === 0) {
		throw new Error("BoundSheet records not found in legacy XLS template");
	}

	const globalBuffer = Buffer.from(
		originalWorkbookBuffer.subarray(0, boundSheets[0].bofPosition),
	);
	const sheetBuffers = new Map<string, Buffer>();

	boundSheets.forEach((sheetInfo, index) => {
		const nextSheetOffset =
			boundSheets[index + 1]?.bofPosition ?? originalWorkbookBuffer.length;
		const originalSheetBuffer = Buffer.from(
			originalWorkbookBuffer.subarray(sheetInfo.bofPosition, nextSheetOffset),
		);
		const patch = sheetPatches[sheetInfo.name];

		if (!patch) {
			sheetBuffers.set(sheetInfo.name, originalSheetBuffer);
			return;
		}

		const sheet = workbook.Sheets[sheetInfo.name];
		if (!sheet) {
			throw new Error(
				`Sheet ${sheetInfo.name} not found in legacy XLS template`,
			);
		}

		sheetBuffers.set(
			sheetInfo.name,
			patchSheetSubstream(originalSheetBuffer, sheet, patch),
		);
	});

	const parts: Buffer[] = [globalBuffer];
	let offset = globalBuffer.length;

	boundSheets.forEach((sheetInfo) => {
		globalBuffer.writeUInt32LE(offset, sheetInfo.recordStart + 4);
		const sheetBuffer = sheetBuffers.get(sheetInfo.name);
		if (!sheetBuffer) {
			throw new Error(`Patched sheet buffer missing for ${sheetInfo.name}`);
		}
		parts.push(sheetBuffer);
		offset += sheetBuffer.length;
	});

	const patchedWorkbookBuffer = Buffer.concat(parts);
	workbookEntry.content = patchedWorkbookBuffer;
	workbookEntry.size = patchedWorkbookBuffer.length;

	return Buffer.from(XLSX.CFB.write(cfb, { type: "buffer" }));
}
