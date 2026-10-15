import assert from "node:assert/strict";
import test from "node:test";
import { filterLeadsByContactType, summarizeLeadContactTypes } from "../lib/leads.ts";

test("lead contact breakdown counts opportunities, not unique clients", () => {
  const rows = summarizeLeadContactTypes([
    { contact_type: "new_contact", status: "booked", session: { agreed_price_cents: 20000 } },
    { contact_type: "existing_client", status: "booked", session: { agreed_price_cents: 30000 } },
    { contact_type: "existing_client", status: "lost", session: null },
    { contact_type: "existing_client", status: "booked", session: { agreed_price_cents: 25000 } },
  ]);

  assert.deepEqual(rows, [
    { contactType: "new_contact", leads: 1, booked: 1, bookedValueCents: 20000, conversionRate: 1, averageTicketCents: 20000 },
    { contactType: "existing_client", leads: 3, booked: 2, bookedValueCents: 55000, conversionRate: 2 / 3, averageTicketCents: 27500 },
  ]);
});

test("legacy leads remain visible as unclassified rather than being inferred from client linkage", () => {
  const rows = summarizeLeadContactTypes([
    { contact_type: null, status: "booked", session: { agreed_price_cents: 12000 } },
  ]);

  assert.deepEqual(rows, [
    { contactType: "new_contact", leads: 0, booked: 0, bookedValueCents: 0, conversionRate: null, averageTicketCents: null },
    { contactType: "existing_client", leads: 0, booked: 0, bookedValueCents: 0, conversionRate: null, averageTicketCents: null },
    { contactType: null, leads: 1, booked: 1, bookedValueCents: 12000, conversionRate: 1, averageTicketCents: 12000 },
  ]);
});

test("analysis contact filter includes only the selected type, while all includes legacy rows", () => {
  const rows = [
    { contact_type: "new_contact", status: "booked" },
    { contact_type: "existing_client", status: "lost" },
    { contact_type: null, status: "booked" },
  ];

  assert.deepEqual(filterLeadsByContactType(rows, "new_contact"), [rows[0]]);
  assert.deepEqual(filterLeadsByContactType(rows, "existing_client"), [rows[1]]);
  assert.deepEqual(filterLeadsByContactType(rows, ""), rows);
});