export type MarvisState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type NavTab = 'home' | 'chat' | 'journal' | 'tools' | 'profile';

export type WidgetId =
  | 'greeting'
  | 'ai-tools'
  | 'shortcuts'
  | 'avatar-chat'
  | 'weather'
  | 'insights'
  | 'schedule'
  | 'devices'
  | 'trending'
  | 'journal';

export interface ThemePalette {
  id: string;
  name: string;
  accent: string;
  accent2: string;
  glow: string;
  bg1: string;
  bg2: string;
  surfaceTint: string;
  isMonochrome?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionSummary?: string;
}

export interface MarvisAction {
  name: string;
  args: Record<string, unknown>;
}

export interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  category: string;
  done: boolean;
  isReminder?: boolean;
}

export interface ConnectedDevice {
  id: string;
  name: string;
  room: string;
  detail: string;
  active: boolean;
  type: 'light' | 'ac' | 'laptop' | 'speaker';
}

export interface WeatherData {
  city: string;
  country: string;
  temperature: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  code: number;
  hourly: Array<{ time: string; temp: number; code: number }>;
  updatedAt: string;
}

export interface JournalArticle {
  id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  citations: number;
  url: string;
  doi?: string;
  abstractText?: string;
  source: 'OpenAlex' | 'Crossref';
}

export interface VoiceSettings {
  voiceURI: string;
  rate: number;
  pitch: number;
  volume: number;
  wakeWordEnabled: boolean;
  autoSpeak: boolean;
}

export interface LayoutConfig {
  order: WidgetId[];
  hidden: WidgetId[];
}

export interface VoiceHistoryEntry {
  id: string;
  query: string;
  reply?: string;
  actionSummary?: string;
  category: 'journal' | 'general';
  journalParams?: {
    query: string;
    yearStart: number;
    yearEnd: number;
  };
  timestamp: string;
  createdAt: number;
}
