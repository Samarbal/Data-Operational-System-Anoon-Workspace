/**
 * Comprehensive Booking Management Routes
 * Handles: Create, Read, Update, Delete bookings with proper validation
 * Timezone: All times stored/compared as-is, displayed with local formatting
 * Payment: Marked as paid only when amount remaining <= 0
 */

import { NextRequest, NextResponse } from "next/server";
import { callProcessRequest } from "@/lib/apps-script-runtime";
import { getSessionFromRequest, canAccessAction } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-utils";
import { errorJson } from "@/lib/api-utils";
import { cache } from "@/lib/cache";

type BookingData = {
  rowIndex?: number;
  name?: string;
  phone?: string;
  hall?: string;
  room?: string;
  date?: string; // DD-MM-YYYY
  start?: string; // HH:MM
  end?: string; // HH:MM
  pipeline?: string;
  payType?: string;
  account?: string;
  notes?: string;
  revenue?: number | string;
  amountPaid?: number | string;
  paid?: "نعم" | "لا";
  chairs?: string | number;
  _action?: string;
  type?: string;
};

type ActionResult = {
  success?: boolean;
  error?: string;
  rowIndex?: number;
  date?: string;
  duration?: string;
  [key: string]: unknown;
};

/**
 * Validate booking data
 */
function validateBookingData(data: BookingData, isUpdate: boolean = false): string | null {
  // For creation, all required fields must be present
  if (!isUpdate) {
    if (!data.hall) return "حقل القاعة مطلوب";
    if (!data.name) return "حقل الاسم مطلوب";
    if (!data.phone) return "حقل الهاتف مطلوب";
    if (!data.date) return "حقل التاريخ مطلوب";
    if (!data.start) return "حقل وقت البداية مطلوب";
    if (!data.end) return "حقل وقت النهاية مطلوب";
  }

  // Validate date format if provided
  if (data.date && !/^\d{2}-\d{2}-\d{4}$/.test(data.date)) {
    return "صيغة التاريخ غير صحيحة (DD-MM-YYYY)";
  }

  // Validate time format
  if (data.start && !/^\d{1,2}:\d{2}$/.test(data.start)) {
    return "صيغة وقت البداية غير صحيحة (HH:MM)";
  }

  if (data.end && !/^\d{1,2}:\d{2}$/.test(data.end)) {
    return "صيغة وقت النهاية غير صحيحة (HH:MM)";
  }

  // Validate phone length
  if (data.phone && String(data.phone).replace(/\D/g, "").length < 9) {
    return "رقم الهاتف غير صحيح";
  }

  // Validate chairs if provided
  if (data.chairs && +data.chairs > 16) {
    return "الحد الأقصى للكراسي 16";
  }

  // Validate revenue is a number if provided
  if (data.revenue !== undefined && data.revenue !== null) {
    const rev = parseFloat(String(data.revenue));
    if (isNaN(rev) || rev < 0) {
      return "المبلغ يجب أن يكون رقم موجب";
    }
  }

  return null;
}

/**
 * Add new booking
 */
async function handleAddBooking(req: NextRequest, data: BookingData) {
  const validationError = validateBookingData(data, false);
  if (validationError) {
    return errorJson(validationError);
  }

  try {
    const result = (await callProcessRequest("addBooking", {
      hall: data.hall,
      name: data.name?.trim(),
      phone: data.phone?.trim(),
      date: data.date, // DD-MM-YYYY
      start: data.start,
      end: data.end,
      pipeline: data.pipeline || "",
      payType: data.payType || "",
      revenue: data.revenue ? parseFloat(String(data.revenue)) : 0,
      amountPaid: data.amountPaid ? parseFloat(String(data.amountPaid)) : 0,
      notes: data.chairs ? `كراسي: ${data.chairs}` : (data.notes || ""),
      chairs: data.chairs || ""
    })) as ActionResult;

    if (!result?.success) {
      return errorJson(result?.error || "فشل إضافة الحجز");
    }

    // Clear cache
    cache.clearByPrefix("read-heavy:");
    return NextResponse.json(result);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "خطأ غير متوقع عند إضافة الحجز"
    );
  }
}

/**
 * Update existing booking
 */
async function handleUpdateBooking(req: NextRequest, data: BookingData) {
  if (!data.rowIndex) {
    return errorJson("رقم السطر مطلوب");
  }

  const validationError = validateBookingData(data, true);
  if (validationError) {
    return errorJson(validationError);
  }

  try {
    const updateData: Record<string, unknown> = {
      rowIndex: data.rowIndex
    };

    // Only include fields that were provided
    if (data.name !== undefined) updateData.name = data.name?.trim();
    if (data.phone !== undefined) updateData.phone = data.phone?.trim();
    if (data.hall !== undefined) updateData.room = data.hall;
    if (data.pipeline !== undefined) updateData.pipeline = data.pipeline;
    if (data.payType !== undefined) updateData.payType = data.payType;
    if (data.account !== undefined) updateData.account = data.account;
    if (data.revenue !== undefined)
      updateData.cost = parseFloat(String(data.revenue)) || 0;
    if (data.amountPaid !== undefined)
      updateData.amountPaid = parseFloat(String(data.amountPaid)) || 0;
    if (data.notes !== undefined)
      updateData.notes = data.chairs
        ? `كراسي: ${data.chairs}`
        : (data.notes || "");
    if (data.paid !== undefined) updateData.paid = data.paid;

    const result = (await callProcessRequest("updateRoom", updateData)) as ActionResult;

    if (!result?.success) {
      return errorJson(result?.error || "فشل تحديث الحجز");
    }

    // Clear cache
    cache.clearByPrefix("read-heavy:");
    return NextResponse.json(result);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "خطأ غير متوقع عند تحديث الحجز"
    );
  }
}

/**
 * Delete booking
 */
async function handleDeleteBooking(req: NextRequest, data: BookingData) {
  if (!data.rowIndex) {
    return errorJson("رقم السطر مطلوب");
  }

  try {
    const result = (await callProcessRequest("deleteBooking", {
      rowIndex: data.rowIndex
    })) as ActionResult;

    if (!result?.success) {
      return errorJson(result?.error || "فشل حذف الحجز");
    }

    // Clear cache
    cache.clearByPrefix("read-heavy:");
    return NextResponse.json(result);
  } catch (error) {
    return errorJson(
      error instanceof Error ? error.message : "خطأ غير متوقع عند حذف الحجز"
    );
  }
}

/**
 * Main booking management route
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const body = await readJsonBody<BookingData & { _action?: string; type?: string }>(req);
  const action = String(body._action ?? body.type ?? "add").trim().toLowerCase();
  const data = body as BookingData;

  // Check permissions for social team
  if (session.role === "social") {
    if (!canAccessAction(session.role, action === "delete" ? "deleteBooking" : "updateRoom")) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية لتنفيذ هذا الإجراء" },
        { status: 403 }
      );
    }
  }

  switch (action) {
    case "add":
    case "create":
      return handleAddBooking(req, data);

    case "update":
    case "edit":
      return handleUpdateBooking(req, data);

    case "delete":
    case "remove":
      return handleDeleteBooking(req, data);

    default:
      return errorJson(`إجراء غير معروف: ${action}`);
  }
}
