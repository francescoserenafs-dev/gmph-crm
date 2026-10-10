-- Ogni pagamento ha sempre sia paid_at sia paid_date: dashboard, analisi e liste possono usare l'uno o l'altro.
-- paid_date = giorno in Europe/Rome; se manca l'orario, paid_at = mezzogiorno di quel giorno (evita slittamenti di fuso).

create or replace function public.sync_payment_dates()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.paid_date is distinct from old.paid_date and new.paid_at is not distinct from old.paid_at then
    new.paid_at := (new.paid_date + time '12:00') at time zone 'Europe/Rome';
  elsif new.paid_at is not null then
    new.paid_date := (new.paid_at at time zone 'Europe/Rome')::date;
  elsif new.paid_date is not null then
    new.paid_at := (new.paid_date + time '12:00') at time zone 'Europe/Rome';
  end if;
  return new;
end;
$$;

create trigger payments_sync_dates before insert or update on public.payments for each row execute function public.sync_payment_dates();

-- Un aggiornamento che non aumenta l'importo (es. solo la data) non puo creare un'eccedenza: non va rivalidato.
create or replace function public.validate_payment_amount()
returns trigger
language plpgsql
as $$
declare
  amount_due_cents integer;
  amount_paid_cents integer;
  extras_cents integer;
begin
  if tg_op = 'UPDATE'
    and new.amount_cents <= old.amount_cents
    and new.session_id is not distinct from old.session_id
    and new.voucher_id is not distinct from old.voucher_id then
    return new;
  end if;

  if new.session_id is not null then
    select agreed_price_cents into amount_due_cents from public.sessions where id = new.session_id;
    select coalesce(sum(price_cents * quantity), 0) into extras_cents from public.session_extras where session_id = new.session_id;
    amount_due_cents := amount_due_cents + extras_cents;
    select coalesce(sum(amount_cents), 0) into amount_paid_cents
    from public.payments
    where session_id = new.session_id and id <> new.id;
  else
    select purchase_price_cents into amount_due_cents from public.gift_vouchers where id = new.voucher_id;
    select coalesce(sum(amount_cents), 0) into amount_paid_cents
    from public.payments
    where voucher_id = new.voucher_id and id <> new.id;
  end if;

  if amount_paid_cents + new.amount_cents > amount_due_cents then
    raise exception 'Payment exceeds the remaining amount due.';
  end if;

  return new;
end;
$$;

-- Riallinea i pagamenti esistenti (paid_at mancante o paid_date mancante/derivata in UTC).
update public.payments set paid_at = paid_at where paid_at is null or paid_date is null or paid_date <> (paid_at at time zone 'Europe/Rome')::date;
