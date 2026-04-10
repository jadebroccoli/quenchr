import { create } from 'zustand';
import type { FeedAudit, Platform, AuditImageResult, AIInsightsResult, AIInsightsStatus } from '@quenchr/shared';
import type { ScanProgress as LegacyScanProgress } from '../services/nsfw-classifier';
import { supabase } from '@quenchr/supabase-client';

/** @deprecated Use FeedAudit[] for audit history instead */
export interface AuditHistoryEntry {
  score: number;
  date: string;
}

export type AuditScreenState = 'input' | 'scanning' | 'results';
export type AuditMode = 'screenshots' | 'livescan';
export type LiveScanState = 'idle' | 'recording' | 'stopping' | 'extracting_frames';

/** Progress for Haiku-based scan (replaces NSFWJS grid-based progress) */
export interface ScanProgress {
  phase: 'uploading' | 'analyzing' | 'complete';
  percentComplete: number;
}

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
  lastCompletedImageResults: AuditImageResult[] | null;
  modelReady: boolean;
  scanError: string | null;

  // Phase 2B: Live scan
  auditMode: AuditMode;
  liveScanState: LiveScanState;
  recordingDurationSeconds: number;
  frameExtractionProgress: { current: number; total: number } | null;

  // Phase 2C: AI Insights
  aiInsights: AIInsightsState;

  // Phase 2D: Haiku scan
  haikuScanStatus: 'idle' | 'scanning' | 'done' | 'error';

  // Audit history — full audit objects for history list + sparkline
  auditHistory: FeedAudit[];

  /** True when the user tapped a past audit to review it (not a fresh scan) */
  isViewingHistory: boolean;

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

  // Phase 2D actions
  setHaikuScanStatus: (status: 'idle' | 'scanning' | 'done' | 'error') => void;

  // Audit history actions
  fetchAuditHistory: (userId: string) => Promise<void>;
  viewAudit: (audit: FeedAudit) => Promise<void>;
  exitHistoryView: () => void;

  // Load latest audit from DB (persists across navigation)
  fetchLatestAudit: (userId: string) => Promise<void>;
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
  lastCompletedImageResults: null,
  modelReady: false,
  scanError: null,

  // Phase 2B defaults
  auditMode: 'screenshots',
  liveScanState: 'idle',
  recordingDurationSeconds: 0,
  frameExtractionProgress: null,

  // Phase 2C defaults
  aiInsights: { status: 'idle', result: null, error: null },

  // Phase 2D defaults
  haikuScanStatus: 'idle',

  // Audit history defaults
  auditHistory: [],
  isViewingHistory: false,

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
    set((state) => ({
      screenState: 'input',
      scanProgress: null,
      // Preserve imageResults for the current audit so they survive navigation
      imageResults: null,
      lastCompletedImageResults: state.imageResults ?? state.lastCompletedImageResults,
      scanError: null,
      scanning: false,
      liveScanState: 'idle',
      recordingDurationSeconds: 0,
      frameExtractionProgress: null,
      aiInsights: { status: 'idle', result: null, error: null },
      haikuScanStatus: 'idle',
      isViewingHistory: false,
    })),

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

  // Phase 2D actions
  setHaikuScanStatus: (haikuScanStatus) => set({ haikuScanStatus }),

  // Load latest audit from DB so results survive navigation.
  // Also sets screenState to 'results' so the results view shows.
  fetchLatestAudit: async (userId: string) => {
    const { data, error } = await supabase
      .from('feed_audits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      set({ currentAudit: data as FeedAudit, screenState: 'results' });
    }
  },

  // Exit history view — return to history list without resetting it
  exitHistoryView: () =>
    set({
      screenState: 'input',
      isViewingHistory: false,
      aiInsights: { status: 'idle', result: null, error: null },
    }),

  // View a historical audit from the scan history list
  viewAudit: async (audit: FeedAudit) => {
    set({
      currentAudit: audit,
      screenState: 'results',
      isViewingHistory: true,
      imageResults: null,
      lastCompletedImageResults: null,
      aiInsights: { status: 'loading', result: null, error: null },
      haikuScanStatus: audit.scan_type === 'haiku' ? 'done' : 'idle',
    });

    // Load persisted AI insights for this audit
    try {
      const { data, error } = await supabase
        .from('ai_insights')
        .select('insights_json')
        .eq('audit_id', audit.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data?.insights_json) {
        set({ aiInsights: { status: 'success', result: data.insights_json as unknown as AIInsightsResult, error: null } });
      } else {
        // No saved insights — just go idle (section will be hidden)
        set({ aiInsights: { status: 'idle', result: null, error: null } });
      }
    } catch {
      set({ aiInsights: { status: 'idle', result: null, error: null } });
    }
  },

  // Audit history actions
  fetchAuditHistory: async (userId: string) => {
    const { data, error } = await supabase
      .from('feed_audits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      set({ auditHistory: data as FeedAudit[] });
    }
  },
}));
