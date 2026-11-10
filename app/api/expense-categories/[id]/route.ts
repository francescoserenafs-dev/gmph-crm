import { type NextRequest, NextResponse } from "next/server";
import { expenseErrorResponse, saveExpenseCategory } from "@/lib/expenses-server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: RouteContext<"/api/expense-categories/[id]">) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ category: await saveExpenseCategory(await request.json().catch(() => null), id) });
  } catch (error) { return expenseErrorResponse(error); }
}