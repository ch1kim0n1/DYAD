import { describe, expect, test } from 'bun:test';
import {
  getUpcomingCareEvents,
  getPastCareEvents,
  storeCareEvents,
} from '@dyad/engine';
import { GBrainClient } from '@dyad/engine';
import type { CareEvent } from '@dyad/shared';

function mockClient(pages: unknown[] = []): GBrainClient {
  return {
    upsertPage: async (page: unknown) => page,
    searchPages: async () => pages,
    getPage: async () => null,
    deletePage: async () => undefined,
  } as unknown as GBrainClient;
}

describe('gbrain care helpers', () => {
  test('getUpcomingCareEvents and getPastCareEvents partition by now', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const events: CareEvent[] = [
      {
        id: 'u1',
        title: 'Upcoming',
        timestamp: future,
        category: 'appointment',
        relatedPersonIds: [],
        linkedObservationIds: [],
      },
      {
        id: 'p1',
        title: 'Past',
        timestamp: past,
        category: 'medication',
        relatedPersonIds: [],
        linkedObservationIds: [],
      },
    ];
    expect(getUpcomingCareEvents(events)).toHaveLength(1);
    expect(getPastCareEvents(events)).toHaveLength(1);
  });

  test('storeCareEvents upserts without throwing', async () => {
    const upserts: unknown[] = [];
    const client = mockClient();
    (client as { upsertPage: (p: unknown) => Promise<unknown> }).upsertPage = async (p) => {
      upserts.push(p);
      return p;
    };
    await storeCareEvents(
      'session-1',
      [
        {
          id: 'e1',
          title: 'Rx ready',
          timestamp: new Date().toISOString(),
          category: 'medication',
          relatedPersonIds: ['email'],
          linkedObservationIds: ['o1'],
        },
      ],
      new Map([['e1', 'msg-hash']]),
      client
    );
    expect(upserts.length).toBe(1);
  });
});
