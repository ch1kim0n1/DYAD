import { create } from 'zustand';
import type {
  NormalizedMessage,
  FeatureVector,
  RelationshipModel,
  SelfModel,
  PartnerModel,
  OrchestratorResult,
} from '@dyad/shared';

export type ActiveView = 'map' | 'atlas' | 'mirror' | 'divergence';

interface DyadStore {
  // Data
  messages: NormalizedMessage[];
  features: FeatureVector[];
  relationshipModel: RelationshipModel | null;
  selfModel: SelfModel | null;
  partnerModel: PartnerModel | null;
  detectorResult: OrchestratorResult | null;
  currentBrief: string | null;
  currentReframe: string | null;
  isLoadingReframe: boolean;
  lastAnalyzedAt: number | null;
  conversationId: string | null;
  /** Offline / degraded mode (#67). When true, LLM-backed views show
   *  a badge instead of stale data; ethical-refusal hard gate stays on. */
  engineOnline: boolean;

  // UI state
  isLoading: boolean;
  error: string | null;
  activeView: ActiveView;

  // Actions
  setMessages: (m: NormalizedMessage[]) => void;
  setFeatures: (f: FeatureVector[]) => void;
  setRelationshipModel: (model: RelationshipModel) => void;
  setSelfModel: (model: SelfModel) => void;
  setPartnerModel: (model: PartnerModel) => void;
  setDetectorResult: (result: OrchestratorResult | null) => void;
  setBrief: (brief: string | null) => void;
  setReframe: (reframe: string | null) => void;
  setLoadingReframe: (loading: boolean) => void;
  setLastAnalyzedAt: (ts: number | null) => void;
  setConversationId: (id: string | null) => void;
  setEngineOnline: (v: boolean) => void;
  setActiveView: (view: ActiveView) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  messages: [],
  features: [],
  relationshipModel: null,
  selfModel: null,
  partnerModel: null,
  detectorResult: null,
  currentBrief: null,
  currentReframe: null,
  isLoadingReframe: false,
  lastAnalyzedAt: null,
  conversationId: null,
  engineOnline: true,
  isLoading: false,
  error: null,
  activeView: 'map' as ActiveView,
};

export const useDyadStore = create<DyadStore>((set) => ({
  ...initialState,
  setMessages: (messages) => set({ messages }),
  setFeatures: (features) => set({ features }),
  setRelationshipModel: (relationshipModel) => set({ relationshipModel }),
  setSelfModel: (selfModel) => set({ selfModel }),
  setPartnerModel: (partnerModel) => set({ partnerModel }),
  setDetectorResult: (detectorResult) => set({ detectorResult }),
  setBrief: (currentBrief) => set({ currentBrief }),
  setReframe: (currentReframe) => set({ currentReframe }),
  setLoadingReframe: (isLoadingReframe) => set({ isLoadingReframe }),
  setLastAnalyzedAt: (lastAnalyzedAt) => set({ lastAnalyzedAt }),
  setConversationId: (conversationId) => set({ conversationId }),
  setEngineOnline: (engineOnline) => set({ engineOnline }),
  setActiveView: (activeView) => set({ activeView }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
