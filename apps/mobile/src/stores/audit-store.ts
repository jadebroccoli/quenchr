import { create } from 'zustand';
import type { FeedAudit, Platform, AuditImageResult, AIInsightsResult, AIInsightsStatus } from '@quenchr/shared';
import type { ScanProgress } from '../services/nsfw-classifier';
import { supabase } from '@quenchr/supabase-client';

export interface AuditHistoryEntry {
  score: number;
  date: string;
}

export type AuditScreenState = 'input' | 'scanning' | 'results';
export type AuditMode = 'screenshots' | 'livescan';
export type LiveScanState = 'idle' | 'recording' | 'stopping' | 'extracting_frames';

export interface AIInsightsState {
  status: AIInsightsStatus;
  result: AIInsightsResult | null;
  error: string | null;
}

interface AuditState {
  // Core
  audits: FeedAudit[];
  currentAudit: FeedAudit | null;
  scanning: boolean;
  selectedPlatform: Platform;

  // Phase 2: ML scan lifecycle
  screenState: AuditScreenState;
  scanProgress: ScanProgress | null;
  imageResults: AuditImageResult[] | null;
  modelReady: boolean;
  scanError: string | null;

  // Phase 2B: Live scan
  auditMode: AuditMode;
  liveScanState: LiveScanState;
  recordingDurationSeconds: number;
  frameExtractionProgress: { current: number; total: number } | null;

  // Phase 2C: AI Insights
  aiInsights: AIInsightsState;

  // Audit history (sparkline)
  auditHistory: AuditHistoryEntry[];

  // Core actions
  setAudits: (audits: FeedAudit[]) => void;
  setCurrentAudit: (audit: FeedAudit | null) => void;
  setScanning: (scanning: boolean) => void;
  setSelectedPlatform: (platform: Platform) => void;
  addAudit: (audit: FeedAudit) => void;

  // Phase 2 actions
  setScreenState: (state: AuditScreenState) => void;
  setScanProgress: (progress: ScanProgress | null) => void;
  setImageResults: (results: AuditImageResult[] | null) => void;
  setModelReady: (ready: boolean) => void;
  setScanError: (error: string | null) => void;
  resetScan: () => void;

  // Phase 2B actions
  setAuditMode: (mode: AuditMode) => void;
  setLiveScanState: (state: LiveScanState) => void;
  setRecordingDuration: (seconds: number) => void;
  setFrameExtractionProgress: (progress: { current: number; total: number } | null) => void;

  // Phase 2C actions
  setAIInsightsStatus: (status: AIInsightsStatus) => void;
  setAIInsightsResult: (result: AIInsightsResult | null) => void;
  setAIInsightsError: (error: string | null) => void;
  resetAIInsights: () => void;

  // Audit history actions
  fetchAuditHistory: (userId: string) => Promise<void>;
}

export const useAuditStore = create<AuditState>((set) => ({
  // Core defaults
  audits: [],
  currentAudit: null,
  scanning: false,
  selectedPlatform: 'instagram',

  // Phase 2 defaults
  screenState: 'input',
  scanProgress: null,
  imageResults: null,
  modelReady: false,
  scanError: null,

  // Phase 2B defaults
  auditMode: 'screenshots',
  liveScanState: 'idle',
  recordingDurationSeconds: 0,
  frameExtractionProgress: null,

  // Phase 2C defaults
  aiInsights: { status: 'idle', result: null, error: null },

  // Audit history defaults
  auditHistory: [],

  // Core actions
  setAudits: (audits) => set({ audits }),
  setCurrentAudit: (currentAudit) => set({ currentAudit }),
  setScanning: (scanning) => set({ scanning }),
  setSelectedPlatform: (selectedPlatform) => set({ selectedPlatform }),
  addAudit: (audit) => set((state) => ({ audits: [audit, ...state.audits], currentAudit: audit })),

  // Phase 2 actions
  setScreenState: (screenState) => set({ screenState }),
  setScanProgress: (scanProgress) => set({ scanProgress }),
  setImageResults: (imageResults) => set({ imageResults }),
  setModelReady: (modelReady) => set({ modelReady }),
  setScanError: (scanError) => set({ scanError }),
  resetScan: () =>
    set({
      screenState: 'input',
      scanProgress: null,
      imageResults: null,
      scanError: null,
      scanning: false,
      liveScanState: 'idle',
      recordingDurationSeconds: 0,
      frameExtractionProgress: null,
      aiInsights: { status: 'idle', result: null, error: null },
    }),

  // Phase 2B actions
  setAuditMode: (auditMode) => set({ auditMode }),
  setLiveScanState: (liveScanState) => set({ liveScanState }),
  setRecordingDuration: (recordingDurationSeconds) => set({ recordingDurationSeconds }),
  setFrameExtractionProgress: (frameExtractionProgress) => set({ frameExtractionProgress }),

  // Phase 2C actions
  setAIInsightsStatus: (status) =>
    set((state) => ({ aiInsights: { ...state.aiInsights, status } })),
  setAIInsightsResult: (result) =>
    set((state) => ({ aiInsights: { ...state.aiInsights, result, status: 'success' as const } })),
  setAIInsightsError: (error) =>
    set((state) => ({ aiInsights: { ...state.aiInsights, error, status: 'error' as const } })),
  resetAIInsights: () =>
    set({ aiInsights: { status: 'idle', result: null, error: null } }),

  // Audit history actions
  fetchAuditHistory: async (userId: string) => {
    const { data, error } = await supabase
      .from('feed_audits')
      .select('feed_score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(20);

    if (!error && data) {
      const history: AuditHistoryEntry[] = data.map((row) => ({
        score: row.feed_score,
        date: row.created_at,
      }));
      set({ auditHistory: history });
    }
  },
}));
