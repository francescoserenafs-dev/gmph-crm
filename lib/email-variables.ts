export const EMAIL_TEMPLATE_VARIABLES = [
  { key: "nome", label: "Nome del cliente" },
  { key: "cognome", label: "Cognome del cliente" },
  { key: "servizio", label: "Servizio della sessione" },
  { key: "data_sessione", label: "Data della sessione" },
  { key: "pacchetto", label: "Nome del pacchetto" },
  { key: "foto_incluse", label: "Numero di foto incluse" },
  { key: "contenuto_pacchetto", label: "Descrizione del pacchetto" },
  { key: "extra", label: "Elenco stampe ed extra (vuoto se assenti)" },
  { key: "link_gallery", label: "Pulsante con il link alla gallery" },
] as const;

export type EmailTemplateVariable = (typeof EMAIL_TEMPLATE_VARIABLES)[number]["key"];
