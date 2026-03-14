// Type declarations for react-native-nitro-screen-recorder
// This native module's types are generated during the native build.
// These declarations provide compile-time safety for managed-workflow development.

declare module 'react-native-nitro-screen-recorder' {
  export interface RecordingOptions {
    enableAudio?: boolean;
  }

  export interface RecordingResult {
    uri: string;
  }

  export function requestPermission(): Promise<boolean>;
  export function startRecording(options?: RecordingOptions): Promise<void>;
  export function stopRecording(): Promise<RecordingResult>;
}
