import { create } from 'zustand';
import type {
  NormalizedMessage,
  FeatureVector,
  RelationshipModel,
  SelfModel,
  PartnerModel,
  OrchestratorResult,
} from '@dyad/shared';

export type ActiveView = 'map' | 'atlas' | 'mirror';

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
  setActiveView: (activeView) => set({ activeView }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
