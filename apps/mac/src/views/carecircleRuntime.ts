export interface CareCircleRuntimeState {
  planAccepted: boolean;
  reminderSet: boolean;
  actionStatus: Record<string, string>;
  draftEdits: Record<string, string>;
  queuedDrafts: Record<string, string>;
  liveNotes: CareLiveNote[];
  calendarBlocks: CareCalendarBlock[];
  selectedReminderStart?: string;
  providerContext?: CareProviderContext;
  gbrainMemory?: CareGBrainMemoryState;
}

export interface CareLiveNote {
  id: string;
  text: string;
  createdAt: string;
  savedToGBrain: boolean;
}

export interface CareCalendarBlock {
  id: string;
  title: string;
  start: string;
  end: string;
}

export interface CareProviderContext {
  status: 'idle' | 'checking' | 'ready' | 'demo' | 'error';
  summary: string;
  checkedAt?: string;
  source: 'thehog' | 'demo';
  operationId?: string;
  requestId?: string;
  items: CareProviderContextItem[];
}

export interface CareProviderContextItem {
  title: string;
  detail: string;
  sourceLabel: string;
}

export interface CareGBrainMemoryState {
  status: 'idle' | 'syncing' | 'saved' | 'local';
  pageId?: string;
  savedAt?: string;
  summary: string;
  memoryCount: number;
  source: 'gbrain' | 'local';
}

export const CARE_RUNTIME_STORAGE_KEY = 'carecircle.runtime.v1';

export const initialCareCircleRuntimeState: CareCircleRuntimeState = {
  planAccepted: false,
  reminderSet: false,
  actionStatus: {},
  draftEdits: {},
  queuedDrafts: {},
  liveNotes: [],
  calendarBlocks: getDefaultCalendarBlocks(),
  selectedReminderStart: undefined,
  providerContext: undefined,
  gbrainMemory: undefined,
};

export function loadCareCircleRuntimeState(): CareCircleRuntimeState {
  if (typeof window === 'undefined') return initialCareCircleRuntimeState;

  try {
    const raw = window.localStorage.getItem(CARE_RUNTIME_STORAGE_KEY);
    if (!raw) return initialCareCircleRuntimeState;
    const parsed = JSON.parse(raw) as Partial<CareCircleRuntimeState>;

    return {
      planAccepted: Boolean(parsed.planAccepted),
      reminderSet: Boolean(parsed.reminderSet),
      actionStatus: parsed.actionStatus ?? {},
      draftEdits: parsed.draftEdits ?? {},
      queuedDrafts: parsed.queuedDrafts ?? {},
      liveNotes: parsed.liveNotes ?? [],
      calendarBlocks: parsed.calendarBlocks ?? getDefaultCalendarBlocks(),
      selectedReminderStart: parsed.selectedReminderStart,
      providerContext: parsed.providerContext,
      gbrainMemory: parsed.gbrainMemory,
    };
  } catch {
    return initialCareCircleRuntimeState;
  }
}

export function saveCareCircleRuntimeState(state: CareCircleRuntimeState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CARE_RUNTIME_STORAGE_KEY, JSON.stringify(state));
}

function getDefaultCalendarBlocks(): CareCalendarBlock[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return [
    createBlock('calendar-standup', 'Work standup', tomorrow, 9, 0, 30),
    createBlock('calendar-commute', 'Commute home', tomorrow, 17, 30, 45),
    createBlock('calendar-dinner', 'Dinner', tomorrow, 18, 30, 45),
  ];
}

function createBlock(id: string, title: string, day: Date, hour: number, minute: number, durationMinutes: number) {
  const start = new Date(day);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return {
    id,
    title,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
