"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatExtraPricing } from "@/components/extras/session-extra-dialog";
import { Modal } from "@/components/shared/modal";
import { EXTRA_CATEGORIES, EXTRA_CATEGORY_LABELS, EXTRA_PRICING_MODES, EXTRA_PRICING_MODE_LABELS, type ExtraCategory, type ExtraPricingMode, type ExtraProduct, parseEurosToCents, validateTiers } from "@/lib/extra-products";

type TierRow = { minQuantity: string; maxQuantity: string; unitPriceEuros: string };
type ProductForm = { id: string | null; name: string; category: ExtraCategory; pricingMode: ExtraPricingMode; unitPriceEuros: string; unitCostEuros: string; isActive: boolean; sortOrder: string; tiers: TierRow[] };

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const centsToInput = (cents: number | null) => (cents === null ? "" : String(cents / 100));
const emptyForm: ProductForm = { id: null, name: "", category: "digital", pricingMode: "unit", unitPriceEuros: "", unitCostEuros: "", isActive: true, sortOrder: "0", tiers: [{ minQuantity: "1", maxQuantity: "", unitPriceEuros: "" }] };

function tierValidationError(rows: TierRow[]): string | null {
  const tiers = rows.map((row) => ({ min_quantity: Number(row.minQuantity), max_quantity: row.maxQuantity === "" ? null : Number(row.maxQuantity), unit_price_cents: parseEurosToCents(row.unitPriceEuros) ?? -1 }));
  return validateTiers(tiers);
}

export function ExtraProductManager() {
  const [products, setProducts] = useState<ExtraProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/extra-products");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setProducts(body.products as ExtraProduct[]);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [refreshKey]);

  function openForm(product?: ExtraProduct) {
    setError(null);
    setForm(product ? {
      id: product.id,
      name: product.name,
      category: product.category,
      pricingMode: product.pricing_mode,
      unitPriceEuros: centsToInput(product.unit_price_cents),
      unitCostEuros: centsToInput(product.unit_cost_cents),
      isActive: product.is_active,
      sortOrder: String(product.sort_order),
      tiers: product.tiers.length > 0
        ? product.tiers.map((tier) => ({ minQuantity: String(tier.min_quantity), maxQuantity: tier.max_quantity === null ? "" : String(tier.max_quantity), unitPriceEuros: centsToInput(tier.unit_price_cents) }))
        : emptyForm.tiers,
    } : emptyForm);
  }

  function updateTier(index: number, patch: Partial<TierRow>) {
    if (!form) return;
    setForm({ ...form, tiers: form.tiers.map((tier, position) => (position === index ? { ...tier, ...patch } : tier)) });
  }

  function addTier() {
    if (!form) return;
    const last = form.tiers[form.tiers.length - 1];
    const nextMin = last && last.maxQuantity ? String(Number(last.maxQuantity) + 1) : "";
    setForm({ ...form, tiers: [...form.tiers, { minQuantity: nextMin, maxQuantity: "", unitPriceEuros: "" }] });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    if (form.pricingMode === "tiered") {
      const tierError = tierValidationError(form.tiers);
      if (tierError) { setError(tierError); return; }
    }
    setBusy(true); setError(null);
    try {
      const response = await fetch(form.id ? `/api/extra-products/${form.id}` : "/api/extra-products", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, category: form.category, pricingMode: form.pricingMode, unitPriceEuros: form.unitPriceEuros, unitCostEuros: form.unitCostEuros, isActive: form.isActive, sortOrder: form.sortOrder, tiers: form.pricingMode === "tiered" ? form.tiers : [] }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setForm(null); setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Salvataggio non riuscito."); } finally { setBusy(false); }
  }

  async function toggleActive(product: ExtraProduct) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/extra-products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !product.is_active }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito."); } finally { setBusy(false); }
  }

  const inputClass = "h-11 border border-[#cfc5b8] bg-white px-3";
  const gridColumns = "sm:grid-cols-[1.1fr_1fr_0.9fr_1.6fr_0.6fr_0.6fr_150px]";

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#9b5d43]">Impostazioni</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Catalogo extra</h1>
            <p className="mt-2 text-sm text-[#675f57]">Prodotti vendibili come extra di una sessione. Le modifiche valgono solo per le nuove vendite.</p>
          </div>
          <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white" onClick={() => openForm()} type="button">Nuovo prodotto</button>
        </header>

        {error && !form ? <p className="mt-5 text-sm text-[#a53e31]">{error}</p> : null}

        <section className="mt-7 overflow-hidden border border-[#d8d0c5] bg-white">
          <div className={`hidden gap-3 bg-[#eee8df] px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#675f57] sm:grid ${gridColumns}`}>
            <span>Nome</span><span>Categoria</span><span>Tipo pricing</span><span>Prezzo</span><span>Costo</span><span>Stato</span><span>Azioni</span>
          </div>
          {loading ? <p className="p-8 text-sm text-[#675f57]">Caricamento catalogo...</p> : products.length === 0 ? <p className="p-10 text-center text-sm text-[#675f57]">Nessun prodotto configurato.</p> : products.map((product) => (
            <article className={`flex flex-col gap-2 border-t border-[#eee8df] px-5 py-4 text-sm sm:grid sm:items-center sm:gap-3 ${gridColumns}`} key={product.id}>
              <span className={`font-semibold ${product.is_active ? "" : "text-[#958b80]"}`}>{product.name}</span>
              <span>{EXTRA_CATEGORY_LABELS[product.category]}</span>
              <span>{EXTRA_PRICING_MODE_LABELS[product.pricing_mode]}</span>
              <span className="text-[#514a43]">{formatExtraPricing(product)}</span>
              <span>{product.unit_cost_cents === null ? "-" : euro.format(product.unit_cost_cents / 100)}</span>
              <span>{product.is_active ? "Attivo" : <span className="text-[#958b80]">Disattivato</span>}</span>
              <span className="flex gap-4">
                <button className="font-semibold text-[#9b5d43] hover:underline disabled:opacity-50" disabled={busy} onClick={() => openForm(product)} type="button">Modifica</button>
                <button className={`font-semibold hover:underline disabled:opacity-50 ${product.is_active ? "text-[#a53e31]" : "text-[#367e4a]"}`} disabled={busy} onClick={() => void toggleActive(product)} type="button">{product.is_active ? "Disattiva" : "Riattiva"}</button>
              </span>
            </article>
          ))}
        </section>
      </section>

      {form ? (
        <Modal onClose={() => setForm(null)} title={form.id ? "Modifica prodotto" : "Nuovo prodotto"}>
          <form onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">Nome
                <input className={inputClass} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} required value={form.name} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Categoria
                <select className={inputClass} onChange={(e) => setForm({ ...form, category: e.target.value as ExtraCategory })} value={form.category}>
                  {EXTRA_CATEGORIES.map((category) => <option key={category} value={category}>{EXTRA_CATEGORY_LABELS[category]}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Modalità prezzo
                <select className={inputClass} onChange={(e) => setForm({ ...form, pricingMode: e.target.value as ExtraPricingMode })} value={form.pricingMode}>
                  {EXTRA_PRICING_MODES.map((mode) => <option key={mode} value={mode}>{EXTRA_PRICING_MODE_LABELS[mode]}</option>)}
                </select>
              </label>
              {form.pricingMode === "unit" ? (
                <label className="flex flex-col gap-2 text-sm font-medium">Prezzo unitario (EUR)
                  <input className={inputClass} min="0" onChange={(e) => setForm({ ...form, unitPriceEuros: e.target.value })} required step="0.01" type="number" value={form.unitPriceEuros} />
                </label>
              ) : <div className="hidden sm:block" />}
              <label className="flex flex-col gap-2 text-sm font-medium">Costo unitario (EUR, facoltativo)
                <input className={inputClass} min="0" onChange={(e) => setForm({ ...form, unitCostEuros: e.target.value })} step="0.01" type="number" value={form.unitCostEuros} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Ordinamento
                <input className={inputClass} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} step="1" type="number" value={form.sortOrder} />
              </label>
            </div>

            {form.pricingMode === "tiered" ? (
              <div className="mt-5">
                <p className="text-sm font-medium">Scaglioni</p>
                <p className="mt-1 text-xs text-[#675f57]">Ogni unità è prezzata con lo scaglione in cui cade. Lascia vuoto &quot;A&quot; nell&apos;ultimo scaglione per non avere limite.</p>
                <div className="mt-3 grid grid-cols-[1fr_1fr_1.2fr_32px] gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#675f57]">
                  <span>Da</span><span>A</span><span>Prezzo unitario (EUR)</span><span />
                </div>
                {form.tiers.map((tier, index) => (
                  <div className="mt-2 grid grid-cols-[1fr_1fr_1.2fr_32px] items-center gap-2" key={index}>
                    <input aria-label="Da" className={inputClass} min="1" onChange={(e) => updateTier(index, { minQuantity: e.target.value })} required type="number" value={tier.minQuantity} />
                    <input aria-label="A" className={inputClass} min="1" onChange={(e) => updateTier(index, { maxQuantity: e.target.value })} placeholder="∞" type="number" value={tier.maxQuantity} />
                    <input aria-label="Prezzo unitario" className={inputClass} min="0" onChange={(e) => updateTier(index, { unitPriceEuros: e.target.value })} required step="0.01" type="number" value={tier.unitPriceEuros} />
                    <button aria-label="Rimuovi scaglione" className="size-8 border border-[#cfc5b8] text-sm disabled:opacity-40" disabled={form.tiers.length === 1} onClick={() => setForm({ ...form, tiers: form.tiers.filter((_, position) => position !== index) })} type="button">x</button>
                  </div>
                ))}
                <button className="mt-3 text-sm font-semibold text-[#9b5d43] hover:underline" onClick={addTier} type="button">Aggiungi scaglione</button>
              </div>
            ) : null}

            <label className="mt-5 flex items-center gap-3 text-sm font-medium">
              <input checked={form.isActive} className="size-4 accent-[#9b5d43]" onChange={(e) => setForm({ ...form, isActive: e.target.checked })} type="checkbox" /> Attivo (selezionabile nelle nuove vendite)
            </label>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => setForm(null)} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : "Salva prodotto"}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
