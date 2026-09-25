-- Rimuove gli stati di avanzamento legati ai pagamenti ("Pagamento ricevuto",
-- "Caparra ricevuta", "Saldo ricevuto").
-- La situazione pagamenti resta gestita solo dalla bandierina rosso/giallo/verde,
-- non piu dal pipeline di avanzamento.
--
-- Nota: nel DB live questi stati possono avere codici diversi da quelli del seed,
-- quindi li intercettiamo sia per code sia per nome (case-insensitive).

-- 1. Sposta su "Prenotata" le sessioni attualmente in uno stato di pagamento
--    (verranno poi sistemate manualmente).
update public.sessions
set current_stage_id = (select id from public.session_stages where code = 'booked')
where current_stage_id in (
  select id
  from public.session_stages
  where code in ('payment_received', 'deposit_received', 'balance_received')
     or lower(btrim(name)) in ('pagamento ricevuto', 'caparra ricevuta', 'saldo ricevuto')
);

-- 2. Disattiva quegli stati cosi non compaiono piu tra le opzioni di avanzamento ne tra i filtri.
--    Non li eliminiamo per preservare lo storico degli avanzamenti passati.
update public.session_stages
set is_active = false
where code in ('payment_received', 'deposit_received', 'balance_received')
   or lower(btrim(name)) in ('pagamento ricevuto', 'caparra ricevuta', 'saldo ricevuto');
