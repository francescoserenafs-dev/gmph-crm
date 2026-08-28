export type ClientListStatus = "active" | "archived";
export type ClientListSort = "alphabetical" | "recent" | "next_session";

export type ClientInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  address: string | null;
  notes: string | null;
  privacyConsentGranted: boolean;
  imageConsentGranted: boolean;
};

type ClientInputResult =
  | { data: ClientInput; error: null }
  | { data: null; error: string };

function readRequiredText(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  if (value.trim().length > 120) {
    return null;
  }

  return value.trim();
}

function readOptionalText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string" || value.trim().length > maxLength) {
    return null;
  }

  return value.trim();
}

export function parseClientInput(value: unknown): ClientInputResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { data: null, error: "I dati del cliente non sono validi." };
  }

  const input = value as Record<string, unknown>;
  const firstName = readRequiredText(input.firstName);
  const lastName = readRequiredText(input.lastName);
  const email = readRequiredText(input.email)?.toLowerCase();
  const phone = readOptionalText(input.phone, 40);
  const birthDate = readOptionalText(input.birthDate, 10);
  const address = readOptionalText(input.address, 500);
  const notes = readOptionalText(input.notes, 2_000);
  const privacyConsentGranted = input.privacyConsentGranted === true;
  const imageConsentGranted = input.imageConsentGranted === true;

  if (!firstName || !lastName || !email) {
    return { data: null, error: "Nome, cognome ed email sono obbligatori." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { data: null, error: "Inserisci un indirizzo email valido." };
  }

  if (input.birthDate && (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate))) {
    return { data: null, error: "La data di nascita non e valida." };
  }

  return {
    data: {
      firstName,
      lastName,
      email,
      phone,
      birthDate,
      address,
      notes,
      privacyConsentGranted,
      imageConsentGranted,
    },
    error: null,
  };
}