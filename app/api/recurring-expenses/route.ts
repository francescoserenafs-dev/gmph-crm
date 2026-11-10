import { type NextRequest, NextResponse } from "next/server";
import { expenseErrorResponse, listRecurringExpenses, saveRecurringExpense } from "@/lib/expenses-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json({ rules: await listRecurringExpenses() }); }
  catch (error) { return expenseErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try { return NextResponse.json({ id: await saveRecurringExpense(await request.json().catch(() => null)) }, { status: 201 }); }
  catch (error) { return expenseErrorResponse(error); }
}