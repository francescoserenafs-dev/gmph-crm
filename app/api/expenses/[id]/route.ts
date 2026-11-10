import { type NextRequest, NextResponse } from "next/server";
import { deleteExpense, expenseErrorResponse, saveExpense } from "@/lib/expenses-server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: RouteContext<"/api/expenses/[id]">) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ expense: await saveExpense(await request.json().catch(() => null), id) });
  } catch (error) { return expenseErrorResponse(error); }
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/expenses/[id]">) {
  try {
    const { id } = await context.params;
    await deleteExpense(id);
    return NextResponse.json({ success: true });
  } catch (error) { return expenseErrorResponse(error); }
}