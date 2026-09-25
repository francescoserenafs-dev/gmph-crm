import { supabaseAdmin } from "@/lib/supabase/admin";

// Sessions have no background job to advance past-due bookings, so a "booked" session
// whose scheduled time has passed is reconciled to "completed" lazily on every read.
export async function promotePastBookedSessions() {
  const nowIso = new Date().toISOString();

  const { data: stages } = await supabaseAdmin.from("session_stages").select("id, code").in("code", ["booked", "completed"]);
  const bookedId = stages?.find((stage) => stage.code === "booked")?.id;
  const completedId = stages?.find((stage) => stage.code === "completed")?.id;
  if (!bookedId || !completedId) return;

  await supabaseAdmin.from("sessions").update({ current_stage_id: completedId }).eq("current_stage_id", bookedId).lt("scheduled_at", nowIso);
}
