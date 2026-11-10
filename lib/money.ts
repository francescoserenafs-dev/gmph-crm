const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const percent = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1 });

export const formatMoney = (cents: number | null) => cents === null ? "\u2014" : euro.format(cents / 100);
export const formatPercent = (value: number | null) => value === null ? "\u2014" : percent.format(value);