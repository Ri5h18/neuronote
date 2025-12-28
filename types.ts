/* =========================
   FOLDERS
========================= */

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  parentId?: string | null; // enables nesting later
}

/* =========================
   NOTES
========================= */

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null; // null = Inbox / Unsorted
  createdAt: number;
  updatedAt: number;
  tags: string[];
  images?: string[]; // Base64 strings
}

/* =========================
   FLASHCARDS (SRS)
========================= */

export type FlashcardState =
  | 'new'
  | 'learning'
  | 'review'
  | 'relearning';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  frontImage?: string;
  backImage?: string;
  deckId: string;

  state: FlashcardState;
  nextReview: number;
  interval: number; // minutes (learning) or days (review)
  easeFactor: number; // default 2.5
  repetitions: number;
  lapses: number;
}

/* =========================
   DECKS
========================= */

export interface DeckSettings {
  newCardsPerDay: number;
  reviewLimitPerDay: number;
  learningSteps: number[]; // minutes, e.g. [1, 10]
  graduatingInterval: number; // days
  easyBonus: number;
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  settings: DeckSettings;
}

/* =========================
   TODO
========================= */

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: number | null;
  priority: 'low' | 'medium' | 'high';
  image?: string;
}

/* =========================
   CALENDAR
========================= */

export interface CalendarEvent {
  id: string;
  title: string;
  start: number;
  end: number;
  description?: string;
  type: 'task' | 'study' | 'custom';
  image?: string;
}

/* =========================
   CLOCK / ALARMS
========================= */

export interface Alarm {
  id: string;
  time: string; // HH:MM (24h)
  label: string;
  active: boolean;
}

/* =========================
   APP VIEW ROUTING
========================= */

export enum AppView {
  DASHBOARD = 'dashboard',
  NOTES = 'notes',
  FLASHCARDS = 'flashcards',
  TODO = 'todo',
  CALENDAR = 'calendar',
  CLOCK = 'clock',
}
