export type ThemeType = 'brutalist' | 'glass' | 'standard' | 'retro' | 'bento';
export type ModeType = 'light' | 'dark';

export interface Transaction {
  id: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  date: string;
  note?: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  description: string;
  image?: string;
  transactions: Transaction[];
  createdAt: string;
  reminderTime?: string; // HH:mm format
}

export interface AppSettings {
  theme: ThemeType;
  mode: ModeType;
  notificationsEnabled: boolean;
  reminderActive: boolean;
  reminderTime?: string; // HH:mm format, e.g. "20:00"
}
