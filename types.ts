
export type Language = {
  id: string;
  name: string;
  flag: string;
  nativeName: string;
  voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
};

export type Scenario = {
  id: string;
  title: string;
  description: string;
  icon: string;
  prompt: string;
  details?: string[];
};

export type TranscriptionEntry = {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  correction?: string;
};

export type VoiceOption = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface AppState {
  language: Language | null;
  scenario: Scenario | null;
  selectedVoice: VoiceOption | null;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  status: 'idle' | 'connecting' | 'active' | 'error';
}
