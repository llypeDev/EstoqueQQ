export interface Product {
  id: string; // Barcode or manual code
  name: string;
  qty: number;
}

export interface Movement {
  id: number;
  date: string; // ISO string
  prodId: string;
  prodName: string;
  qty: number; // Negative for removal, positive for addition
  obs?: string;
  matricula?: string;
}

export interface SupabaseConfig {
  url: string;
  key: string;
}

export type ViewState = 'home' | 'scan' | 'history';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}