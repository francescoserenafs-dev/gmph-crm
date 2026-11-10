import { type NextRequest, NextResponse } from "next/server";
import { expenseErrorResponse, saveRecurringExpense } from "@/lib/expenses-server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: RouteContext<"/api/recurring-expenses/[id]">) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ id: await saveRecurringExpense(await request.json().catch(() => null), id) });
  } catch (error) { return expenseErrorResponse(error); }
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/recurring-expenses/[id]">) {
  try {
    const { id } = await context.params;
    await saveRecurringExpense({ is_active: false }, id);
    return NextResponse.json({ success: true });
  } catch (error) { return expenseErrorResponse(error); }
}