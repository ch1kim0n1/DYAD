import {
  analyzeCareWeek as analyzeCareWeekFromEngine,
  careCircleFixture,
} from '@dyad/engine';
import type { CareBrief as SharedCareBrief, CareCircleGraph as SharedCareCircleGraph } from '@dyad/shared';

export type CareTab = 'dashboard' | 'timeline' | 'brief' | 'messages' | 'trust';
export type {
  CareAction,
  CareBrief,
  CareCircleGraph,
  CareEvent,
  CareInsight,
  CareLoop,
  CareMessageDrafts,
  CareObservation,
  CarePerson,
} from '@dyad/shared';

export { careCircleFixture };

export function analyzeCareWeek(graph: SharedCareCircleGraph = careCircleFixture): SharedCareBrief {
  return analyzeCareWeekFromEngine(graph);
}

export function personName(id: string): string {
  return careCircleFixture.people.find((person) => person.id === id)?.name ?? id;
}

export function evidenceText(ids: string[]): string[] {
  return ids
    .map((id) => careCircleFixture.observations.find((observation) => observation.id === id)?.text)
    .filter((text): text is string => Boolean(text));
}
