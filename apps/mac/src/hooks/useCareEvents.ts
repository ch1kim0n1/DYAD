import { useCallback, useEffect, useState } from 'react';
import type { CareCircleGraph, CareEvent, CareObservation } from '@dyad/shared';
import { careCircleFixture } from '../views/carecircleDemo.js';
import {
  fetchCareEvents,
  getGmailStatus,
  syncGmail,
  type GmailStatus,
} from '../lib/gbrain-bridge.js';

export type CareCategoryFilter = 'all' | 'medication' | 'appointment' | 'family_call';

export interface UseCareEventsResult {
  graph: CareCircleGraph;
  upcoming: CareEvent[];
  past: CareEvent[];
  gmailStatus: GmailStatus | null;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  categoryFilter: CareCategoryFilter;
  setCategoryFilter: (f: CareCategoryFilter) => void;
  refresh: () => Promise<void>;
  syncInbox: () => Promise<void>;
}

function mergeGraph(
  base: CareCircleGraph,
  events: CareEvent[],
  observations: CareObservation[]
): CareCircleGraph {
  const eventIds = new Set(base.events.map((e) => e.id));
  const obsIds = new Set(base.observations.map((o) => o.id));
  return {
    ...base,
    events: [
      ...base.events,
      ...events.filter((e) => !eventIds.has(e.id)),
    ],
    observations: [
      ...base.observations,
      ...observations.filter((o) => !obsIds.has(o.id)),
    ],
  };
}

function filterByCategory(events: CareEvent[], filter: CareCategoryFilter): CareEvent[] {
  if (filter === 'all') return events;
  if (filter === 'family_call') return events.filter((e) => e.category === 'family_call');
  return events.filter((e) => e.category === filter);
}

export function useCareEvents(): UseCareEventsResult {
  const [graph, setGraph] = useState<CareCircleGraph>(careCircleFixture);
  const [upcoming, setUpcoming] = useState<CareEvent[]>([]);
  const [past, setPast] = useState<CareEvent[]>([]);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CareCategoryFilter>('all');
  const [useLiveData, setUseLiveData] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [status, care] = await Promise.all([getGmailStatus(), fetchCareEvents()]);
    setGmailStatus(status);

    if (care && care.gmail_connected && care.events.length > 0) {
      setUseLiveData(true);
      setUpcoming(filterByCategory(care.upcoming, categoryFilter));
      setPast(filterByCategory(care.past, categoryFilter));
      setGraph(mergeGraph(careCircleFixture, care.events, care.observations));
    } else {
      setUseLiveData(false);
      const fixtureUpcoming = careCircleFixture.events.filter(
        (e) => Date.parse(e.timestamp) > Date.now()
      );
      const fixturePast = careCircleFixture.events.filter(
        (e) => Date.parse(e.timestamp) <= Date.now()
      );
      setUpcoming(filterByCategory(fixtureUpcoming, categoryFilter));
      setPast(filterByCategory(fixturePast, categoryFilter));
      setGraph(careCircleFixture);
    }
    setLoading(false);
  }, [categoryFilter]);

  const syncInbox = useCallback(async () => {
    setSyncing(true);
    setError(null);
    const result = await syncGmail();
    if (!result) {
      setError('Gmail sync failed — is the sidecar running?');
      setSyncing(false);
      return;
    }
    if (result.error) {
      setError(result.error);
      setSyncing(false);
      return;
    }
    await refresh();
    setSyncing(false);
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!useLiveData) {
      const fixtureUpcoming = careCircleFixture.events.filter(
        (e) => Date.parse(e.timestamp) > Date.now()
      );
      const fixturePast = careCircleFixture.events.filter(
        (e) => Date.parse(e.timestamp) <= Date.now()
      );
      setUpcoming(filterByCategory(fixtureUpcoming, categoryFilter));
      setPast(filterByCategory(fixturePast, categoryFilter));
    }
  }, [categoryFilter, useLiveData]);

  return {
    graph,
    upcoming,
    past,
    gmailStatus,
    loading,
    syncing,
    error,
    categoryFilter,
    setCategoryFilter,
    refresh,
    syncInbox,
  };
}
