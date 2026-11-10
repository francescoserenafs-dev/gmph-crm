import { type NextRequest, NextResponse } from "next/server";
import { expenseErrorResponse, loadExpenseOptions, saveExpenseCategory } from "@/lib/expenses-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json({ categories: (await loadExpenseOptions()).categories }); }
  catch (error) { return expenseErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try { return NextResponse.json({ category: await saveExpenseCategory(await request.json().catch(() => null)) }, { status: 201 }); }
  catch (error) { return expenseErrorResponse(error); }
}