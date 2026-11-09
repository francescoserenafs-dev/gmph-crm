import assert from "node:assert/strict";
import test from "node:test";
import { hasClientPrivacyConsent, matchesClientPrivacyFilter } from "../lib/clients.ts";

const granted = { privacy_consent_granted_at: "2026-11-09T10:00:00Z", privacy_consent_revoked_at: null };
const missing = { privacy_consent_granted_at: null, privacy_consent_revoked_at: null };
const revoked = { privacy_consent_granted_at: "2026-11-08T10:00:00Z", privacy_consent_revoked_at: "2026-11-09T10:00:00Z" };

test("privacy consent is active only when granted and not revoked", () => {
  assert.equal(hasClientPrivacyConsent(granted), true);
  assert.equal(hasClientPrivacyConsent(missing), false);
  assert.equal(hasClientPrivacyConsent(revoked), false);
});

test("privacy filter includes revoked consent among clients without consent", () => {
  const clients = [granted, missing, revoked];
  assert.deepEqual(clients.filter((client) => matchesClientPrivacyFilter(client, "all")), clients);
  assert.deepEqual(clients.filter((client) => matchesClientPrivacyFilter(client, "granted")), [granted]);
  assert.deepEqual(clients.filter((client) => matchesClientPrivacyFilter(client, "missing")), [missing, revoked]);
});