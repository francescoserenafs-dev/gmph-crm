export type RetentionSession = {
  id: string;
  clientId: string;
  clientName: string;
  scheduledAt: string;
  serviceTypeId: string;
  serviceTypeName: string;
  serviceName: string;
  agreedPriceCents: number;
  extrasCents: number;
  isCancelled: boolean;
  isAddon: boolean;
};

type AnalyzeOptions = {
  sessions: RetentionSession[];
  year: number;
  now: Date;
  reactivationMonths: number;
  initialServiceId?: string;
  nextServiceId?: string;
};

function localDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function monthIndex(value: Date): number {
  const [year, month] = localDateKey(value).split("-").map(Number);
  return year * 12 + month - 1;
}

function elapsedMonths(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (30.436875 * 24 * 60 * 60 * 1000);
}

function isLegacyProofs(session: RetentionSession): boolean {
  return [session.serviceName, session.serviceTypeName].some((name) => name.trim().toLocaleLowerCase("it-IT") === "provini extra");
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function deduplicateExactBookings(sessions: RetentionSession[]): RetentionSession[] {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    const key = `${session.clientId}:${session.serviceTypeId}:${new Date(session.scheduledAt).toISOString()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function analyzeClientRetention({
  sessions,
  year,
  now,
  reactivationMonths,
  initialServiceId = "",
  nextServiceId = "",
}: AnalyzeOptions) {
  const nowTime = now.getTime();
  const valid = deduplicateExactBookings(sessions.filter((session) =>
    !session.isCancelled && !session.isAddon && !isLegacyProofs(session),
  ));
  const pastByClient = new Map<string, RetentionSession[]>();
  const futureClientIds = new Set<string>();

  for (const session of valid) {
    if (new Date(session.scheduledAt).getTime() > nowTime) {
      futureClientIds.add(session.clientId);
      continue;
    }
    const clientSessions = pastByClient.get(session.clientId) ?? [];
    clientSessions.push(session);
    pastByClient.set(session.clientId, clientSessions);
  }

  for (const clientSessions of pastByClient.values()) {
    clientSessions.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime() || a.id.localeCompare(b.id));
  }

  const periodSessions = valid.filter((session) => {
    const date = new Date(session.scheduledAt);
    return date.getTime() <= nowTime && Number(localDateKey(date).slice(0, 4)) === year;
  });
  const servedClientIds = new Set(periodSessions.map((session) => session.clientId));
  const newClientIds = new Set<string>();
  const returningClientIds = new Set<string>();
  const repeatClientIds = new Set<string>();
  const byMonth = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, newClients: 0, returningClients: 0 }));

  for (const clientId of servedClientIds) {
    const clientSessions = pastByClient.get(clientId) ?? [];
    if (clientSessions[0] && Number(localDateKey(new Date(clientSessions[0].scheduledAt)).slice(0, 4)) === year) {
      newClientIds.add(clientId);
    }
    // Returning solo se una sessione del periodo non è la prima: le sessioni successive al periodo non contano.
    if (clientSessions.slice(1).some((session) => Number(localDateKey(new Date(session.scheduledAt)).slice(0, 4)) === year)) {
      returningClientIds.add(clientId);
    }
    if (clientSessions.length > 1) repeatClientIds.add(clientId);
  }

  for (const clientSessions of pastByClient.values()) {
    const byClientMonth = new Map<number, RetentionSession[]>();
    for (const session of clientSessions) {
      const date = new Date(session.scheduledAt);
      const key = monthIndex(date);
      if (Math.floor(key / 12) !== year) continue;
      const group = byClientMonth.get(key) ?? [];
      group.push(session);
      byClientMonth.set(key, group);
    }
    for (const [key, monthSessions] of byClientMonth) {
      const month = key % 12;
      const firstEver = clientSessions[0];
      const isNewThisMonth = firstEver && monthIndex(new Date(firstEver.scheduledAt)) === key;
      const bucket = byMonth[month];
      if (isNewThisMonth) bucket.newClients += 1;
      else if (monthSessions.length > 0) bucket.returningClients += 1;
    }
  }

  const periodCommercialValue = periodSessions.reduce((sum, session) => sum + session.agreedPriceCents + session.extrasCents, 0);
  const secondServiceIntervals: number[] = [];
  const customerValue = {
    oneSession: { clients: 0, totalCents: 0 },
    returning: { clients: 0, totalCents: 0 },
  };

  for (const clientId of servedClientIds) {
    const clientSessions = pastByClient.get(clientId) ?? [];
    const lifetimeValue = clientSessions.reduce((sum, session) => sum + session.agreedPriceCents + session.extrasCents, 0);
    const valueGroup = clientSessions.length > 1 ? customerValue.returning : customerValue.oneSession;
    valueGroup.clients += 1;
    valueGroup.totalCents += lifetimeValue;
    if (clientSessions.length > 1) {
      secondServiceIntervals.push(elapsedMonths(new Date(clientSessions[0].scheduledAt), new Date(clientSessions[1].scheduledAt)));
    }
  }

  const journeysByPair = new Map<string, { clientIds: Set<string>; fromName: string; toName: string; fromId: string; toId: string }>();
  for (const [clientId, clientSessions] of pastByClient) {
    for (let index = 1; index < clientSessions.length; index += 1) {
      const previous = clientSessions[index - 1];
      const current = clientSessions[index];
      if (initialServiceId && previous.serviceTypeId !== initialServiceId) continue;
      if (nextServiceId && current.serviceTypeId !== nextServiceId) continue;
      const key = `${previous.serviceTypeId}:${current.serviceTypeId}`;
      const pair = journeysByPair.get(key) ?? {
        clientIds: new Set<string>(),
        fromName: previous.serviceTypeName || previous.serviceName,
        toName: current.serviceTypeName || current.serviceName,
        fromId: previous.serviceTypeId,
        toId: current.serviceTypeId,
      };
      pair.clientIds.add(clientId);
      journeysByPair.set(key, pair);
    }
  }

  const todayKey = localDateKey(now);
  const [todayYear, todayMonth, todayDay] = todayKey.split("-").map(Number);
  const reactivationRows = Array.from(pastByClient.entries()).flatMap(([clientId, clientSessions]) => {
    if (futureClientIds.has(clientId)) return [];
    const lastSession = clientSessions[clientSessions.length - 1];
    const lastDate = new Date(lastSession.scheduledAt);
    const lastDateKey = localDateKey(lastDate);
    const elapsedWholeMonths = (todayYear - Number(lastDateKey.slice(0, 4))) * 12
      + (todayMonth - Number(lastDateKey.slice(5, 7)))
      - (todayDay < Number(lastDateKey.slice(8, 10)) ? 1 : 0);
    if (elapsedWholeMonths < reactivationMonths) return [];
    return [{
      clientId,
      clientName: lastSession.clientName,
      lastSessionAt: lastSession.scheduledAt,
      lastServiceName: lastSession.serviceTypeName || lastSession.serviceName,
      monthsSinceLastSession: elapsedWholeMonths,
      sessions: clientSessions.length,
      cumulativeValueCents: clientSessions.reduce((sum, session) => sum + session.agreedPriceCents + session.extrasCents, 0),
    }];
  }).sort((a, b) => b.monthsSinceLastSession - a.monthsSinceLastSession || a.clientName.localeCompare(b.clientName));

  const secondServiceMedianMonths = median(secondServiceIntervals);
  const servedClients = servedClientIds.size;

  return {
    totals: {
      servedClients,
      newClients: newClientIds.size,
      returningClients: returningClientIds.size,
      repeatClientRate: servedClients > 0 ? repeatClientIds.size / servedClients : null,
      averageSessionsPerClient: servedClients > 0 ? periodSessions.length / servedClients : null,
      averageCommercialValuePerClientCents: servedClients > 0 ? periodCommercialValue / servedClients : null,
      futureReturningClients: Array.from(futureClientIds).filter((clientId) => (pastByClient.get(clientId)?.length ?? 0) > 0).length,
    },
    byMonth,
    secondServiceMedianMonths,
    secondServiceAverageMonths: secondServiceIntervals.length > 0
      ? secondServiceIntervals.reduce((sum, value) => sum + value, 0) / secondServiceIntervals.length
      : null,
    customerValue: {
      oneSession: {
        clients: customerValue.oneSession.clients,
        averageCents: customerValue.oneSession.clients > 0 ? customerValue.oneSession.totalCents / customerValue.oneSession.clients : null,
      },
      returning: {
        clients: customerValue.returning.clients,
        averageCents: customerValue.returning.clients > 0 ? customerValue.returning.totalCents / customerValue.returning.clients : null,
      },
    },
    journeys: Array.from(journeysByPair.values())
      .map((pair) => ({ fromId: pair.fromId, fromName: pair.fromName, toId: pair.toId, toName: pair.toName, clients: pair.clientIds.size }))
      .sort((a, b) => b.clients - a.clients || a.fromName.localeCompare(b.fromName) || a.toName.localeCompare(b.toName)),
    futureReturningClients: Array.from(futureClientIds).filter((clientId) => (pastByClient.get(clientId)?.length ?? 0) > 0),
    reactivationRows,
  };
}