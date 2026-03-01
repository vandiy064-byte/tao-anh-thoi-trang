
export interface GenerationSettings {
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  pose: string;
  environment: string;
  environmentDetail: string; // Chi tiết bối cảnh
  clothingStyle: string;
  clothingType: string;
  clothingDetail: string;
  shotType: string; // Thêm góc chụp
}

export interface CompositionResult {
  id: string;
  imageUrl: string;
  prompt: string;
  timestamp: number;
}

export enum AppStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  CHANGING_BACKGROUND = 'CHANGING_BACKGROUND',
  ERROR = 'ERROR'
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
