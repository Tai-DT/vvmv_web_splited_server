import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import type { Site } from "@/prisma/client";

/**
 * GET /api/trucking-followup/payment-request?truckingFollowUpId=xxx
 * List all payment requests for a trucking follow-up
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const truckingFollowUpId = searchParams.get("truckingFollowUpId");

		if (!truckingFollowUpId) {
			return NextResponse.json(
				{ message: "Missing truckingFollowUpId" },
				{ status: 400 },
			);
		}

		const records = await prismaRPA.paymentRequest.findMany({
			where: { truckingFollowUpId },
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
			orderBy: { createdAt: "asc" },
		});

		return NextResponse.json(records);
	} catch (error) {
		console.error("Error fetching payment requests:", error);
		return NextResponse.json(
			{ message: "Failed to fetch payment requests" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/trucking-followup/payment-request
 * Create a new payment request for a trucking follow-up
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const {
			truckingFollowUpId,
			declarationNumber,
			taxCode,
			amount,
			authority,
			type,
			arNumber,
			notifyNumber,
		} = body;

		if (!truckingFollowUpId) {
			return NextResponse.json(
				{ message: "Missing truckingFollowUpId" },
				{ status: 400 },
			);
		}

		// Get domain from the parent trucking record
		const truckingRecord = await prismaRPA.truckingFollowUp.findUnique({
			where: { id: truckingFollowUpId },
			select: { domain: true },
		});

		if (!truckingRecord) {
			return NextResponse.json(
				{ message: "Trucking follow-up not found" },
				{ status: 404 },
			);
		}

		const newRecord = await prismaRPA.paymentRequest.create({
			data: {
				truckingFollowUpId,
				declarationNumber: declarationNumber || null,
				taxCode: taxCode || null,
				amount: amount ? Number(amount) : null,
				authority: authority || null,
				type: type || null,
				arNumber: arNumber || null,
				notifyNumber: notifyNumber || null,
				createdBy: session.user.id,
				domain: (truckingRecord.domain as Site) || undefined,
			},
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
		});

		return NextResponse.json(newRecord, { status: 201 });
	} catch (error) {
		console.error("Error creating payment request:", error);
		return NextResponse.json(
			{ message: "Failed to create payment request" },
			{ status: 500 },
		);
	}
}

/**
 * PATCH /api/trucking-followup/payment-request
 * Update a payment request
 */
export async function PATCH(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const {
			id,
			declarationNumber,
			taxCode,
			amount,
			authority,
			type,
			arNumber,
			notifyNumber,
		} = body;

		if (!id) {
			return NextResponse.json({ message: "Missing id" }, { status: 400 });
		}

		const existing = await prismaRPA.paymentRequest.findUnique({
			where: { id },
		});
		if (!existing) {
			return NextResponse.json(
				{ message: "Record not found" },
				{ status: 404 },
			);
		}

		const updated = await prismaRPA.paymentRequest.update({
			where: { id },
			data: {
				declarationNumber:
					declarationNumber !== undefined
						? declarationNumber || null
						: existing.declarationNumber,
				taxCode: taxCode !== undefined ? taxCode || null : existing.taxCode,
				amount:
					amount !== undefined
						? amount
							? Number(amount)
							: null
						: existing.amount,
				authority:
					authority !== undefined ? authority || null : existing.authority,
				type: type !== undefined ? type || null : existing.type,
				arNumber: arNumber !== undefined ? arNumber || null : existing.arNumber,
				notifyNumber:
					notifyNumber !== undefined
						? notifyNumber || null
						: existing.notifyNumber,
			},
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
		});

		return NextResponse.json(updated);
	} catch (error) {
		console.error("Error updating payment request:", error);
		return NextResponse.json(
			{ message: "Failed to update payment request" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/trucking-followup/payment-request?id=xxx
 * Delete a payment request
 */
export async function DELETE(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");

		if (!id) {
			return NextResponse.json({ message: "Missing id" }, { status: 400 });
		}

		await prismaRPA.paymentRequest.delete({ where: { id } });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting payment request:", error);
		return NextResponse.json(
			{ message: "Failed to delete payment request" },
			{ status: 500 },
		);
	}
}
