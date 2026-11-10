import { type NextRequest, NextResponse } from "next/server";
import { expenseErrorResponse, expenseYear, loadExpenseOptions, loadExpenses, materializeDueRecurringExpenses, saveExpense } from "@/lib/expenses-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const year = expenseYear(request.nextUrl.searchParams.get("year"));
    await materializeDueRecurringExpenses();
    const [expenses, options] = await Promise.all([loadExpenses(year), loadExpenseOptions()]);
    return NextResponse.json({ year, expenses, options });
  } catch (error) { return expenseErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try { return NextResponse.json({ expense: await saveExpense(await request.json().catch(() => null)) }, { status: 201 }); }
  catch (error) { return expenseErrorResponse(error); }
}