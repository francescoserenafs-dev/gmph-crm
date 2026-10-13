"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/shared/modal";
import { EXTRA_CATEGORY_LABELS, type ExtraProduct, MAX_EXTRA_QUANTITY, computeSuggestedTotalCents } from "@/lib/extra-products";

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function formatExtraPricing(product: Pick<ExtraProduct, "pricing_mode" | "unit_price_cents" | "tiers">) {
  if (product.pricing_mode === "unit") return product.unit_price_cents === null ? "-" : `${euro.format(product.unit_price_cents / 100)} cad.`;
  return product.tiers.map((tier) => `${tier.max_quantity === null ? `${tier.min_quantity}+` : `${tier.min_quantity}–${tier.max_quantity}`}: ${euro.format(tier.unit_price_cents / 100)}`).join(" · ");
}

const centsToInput = (cents: number | null) => (cents === null ? "" : String(cents / 100));

export function SessionExtraDialog({ sessionId, onClose, onSaved }: { sessionId: string; onClose: () => void; onSaved: () => void }) {
  const [products, setProducts] = useState<ExtraProduct[] | null>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");
  const [lineTotal, setLineTotal] = useState("");
  const [totalEdited, setTotalEdited] = useState(false);
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/extra-products");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setProducts((body.products as ExtraProduct[]).filter((product) => product.is_active));
      } catch (reason) {
        if (active) { setProducts([]); setError(reason instanceof Error ? reason.message : "Catalogo non disponibile."); }
      }
    })();
    return () => { active = false; };
  }, []);

  const product = products?.find((item) => item.id === productId) ?? null;
  const quantityNumber = Number(quantity);
  const suggestedCents = useMemo(() => (product ? computeSuggestedTotalCents(product, quantityNumber) : null), [product, quantityNumber]);
  const shownTotal = totalEdited ? lineTotal : centsToInput(suggestedCents);
  const isOverride = totalEdited && suggestedCents !== null && Math.round(Number(lineTotal.replace(",", ".")) * 100) !== suggestedCents;

  function selectProduct(id: string) {
    const selected = products?.find((item) => item.id === id) ?? null;
    setProductId(id);
    setTotalEdited(false);
    setUnitCost(centsToInput(selected?.unit_cost_cents ?? null));
    setDescription(selected?.category === "other" ? "" : selected?.name ?? "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraProductId: productId, quantity, lineTotalEuros: shownTotal, unitCostEuros: unitCost, description, notes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aggiunta extra non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "h-11 border border-[#cfc5b8] bg-white px-3";

  return (
    <Modal onClose={onClose} title="Aggiungi extra">
      <form onSubmit={submit}>
        {products === null ? <p className="text-sm text-[#675f57]">Caricamento catalogo...</p> : products.length === 0 ? (
          <p className="text-sm text-[#675f57]">Nessun prodotto extra attivo. Configuralo in Impostazioni → Extra.</p>
        ) : (
          <>
            <label className="flex flex-col gap-2 text-sm font-medium">Prodotto
              <select className={inputClass} onChange={(e) => selectProduct(e.target.value)} required value={productId}>
                <option value="">Seleziona</option>
                {products.map((item) => <option key={item.id} value={item.id}>{item.name} · {EXTRA_CATEGORY_LABELS[item.category]}</option>)}
              </select>
            </label>
            {product ? <p className="mt-2 text-xs text-[#675f57]">{EXTRA_CATEGORY_LABELS[product.category]} · {formatExtraPricing(product)}</p> : null}

            {product ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {product.category === "other" ? (
                  <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">Descrizione
                    <input className={inputClass} maxLength={120} onChange={(e) => setDescription(e.target.value)} placeholder={product.name} required value={description} />
                  </label>
                ) : null}
                <label className="flex flex-col gap-2 text-sm font-medium">Quantità
                  <input className={inputClass} max={MAX_EXTRA_QUANTITY} min="1" onChange={(e) => setQuantity(e.target.value)} required type="number" value={quantity} />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">Totale (EUR)
                  <input className={inputClass} min="0" onChange={(e) => { setTotalEdited(true); setLineTotal(e.target.value); }} required step="0.01" type="number" value={shownTotal} />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">Costo unitario (EUR, facoltativo)
                  <input className={inputClass} min="0" onChange={(e) => setUnitCost(e.target.value)} step="0.01" type="number" value={unitCost} />
                </label>
                <div className="flex flex-col justify-end text-sm text-[#675f57]">
                  {suggestedCents === null ? <p className="text-[#a53e31]">Quantità oltre l&apos;ultimo scaglione.</p> : <p>Totale suggerito: <span className="font-semibold text-[#27231f]">{euro.format(suggestedCents / 100)}</span></p>}
                  {isOverride ? <p className="mt-1 text-[#9b5d43]">Importo modificato manualmente</p> : null}
                  {totalEdited ? <button className="mt-1 self-start text-xs font-semibold text-[#9b5d43] hover:underline" onClick={() => setTotalEdited(false)} type="button">Usa il suggerito</button> : null}
                </div>
              </div>
            ) : null}

            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Note (facoltativo, es. formato e carta)
              <input className={inputClass} maxLength={500} onChange={(e) => setNotes(e.target.value)} value={notes} />
            </label>
          </>
        )}
        {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button className="h-11 px-4 text-sm font-semibold" onClick={onClose} type="button">Annulla</button>
          <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !product || suggestedCents === null} type="submit">{busy ? "Salvataggio..." : "Aggiungi extra"}</button>
        </div>
      </form>
    </Modal>
  );
}
