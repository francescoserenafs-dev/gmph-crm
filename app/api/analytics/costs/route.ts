import { type NextRequest, NextResponse } from "next/server";
import { expenseErrorResponse, expenseYear, loadCostAnalytics } from "@/lib/expenses-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try { return NextResponse.json(await loadCostAnalytics(expenseYear(request.nextUrl.searchParams.get("year")))); }
  catch (error) { return expenseErrorResponse(error); }
}