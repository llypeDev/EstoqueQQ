import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Movement, SupabaseConfig } from '../types';

const LS_PRODUCTS = 'stock_products';
const LS_MOVEMENTS = 'stock_movements';
const LS_CONFIG_URL = 'qq_sb_url';
const LS_CONFIG_KEY = 'qq_sb_key';

// Credenciais fixas
const DEFAULT_URL = 'https://fnhapvoxgqkzokravccd.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaGFwdm94Z3Frem9rcmF2Y2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU5ODksImV4cCI6MjA4MDgwMTk4OX0.xmZ4F4Zwc4azBr5niczcD9ct37CnTsPb1IFCTKhZ-Bw';

let supabase: SupabaseClient | null = null;

// Initialize Supabase if credentials exist
export const initSupabase = (): boolean => {
  // Prioriza as credenciais fixas, se não existirem, tenta o localStorage
  const url = DEFAULT_URL || localStorage.getItem(LS_CONFIG_URL);
  const key = DEFAULT_KEY || localStorage.getItem(LS_CONFIG_KEY);
  
  if (url && key) {
    try {
      supabase = createClient(url, key);
      return true;
    } catch (e) {
      console.error("Failed to init supabase", e);
      return false;
    }
  }
  return false;
};

export const getSupabaseConfig = (): SupabaseConfig => ({
  url: DEFAULT_URL || localStorage.getItem(LS_CONFIG_URL) || '',
  key: DEFAULT_KEY || localStorage.getItem(LS_CONFIG_KEY) || ''
});

export const saveSupabaseConfig = (config: SupabaseConfig) => {
  localStorage.setItem(LS_CONFIG_URL, config.url);
  localStorage.setItem(LS_CONFIG_KEY, config.key);
  initSupabase();
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem(LS_CONFIG_URL);
  localStorage.removeItem(LS_CONFIG_KEY);
  // Mesmo limpando o storage, se tivermos DEFAULT, ele vai reconectar no próximo init
  supabase = null;
};

// --- DATA METHODS ---

export const fetchProducts = async (): Promise<Product[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (!error && data) return data;
  }
  const local = localStorage.getItem(LS_PRODUCTS);
  return local ? JSON.parse(local) : [];
};

export const saveProduct = async (product: Product, isNew: boolean): Promise<void> => {
  if (supabase) {
    if (isNew) {
      const { error } = await supabase.from('products').insert([product]);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('products').update({ qty: product.qty }).eq('id', product.id);
      if (error) throw new Error(error.message);
    }
  } else {
    // Local Logic
    const products = await fetchProducts();
    let newProducts = [...products];
    if (isNew) {
      if (products.find(p => p.id === product.id)) throw new Error("Produto já existe!");
      newProducts.unshift(product);
    } else {
      newProducts = products.map(p => p.id === product.id ? product : p);
    }
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(newProducts));
  }
};

export const fetchMovements = async (): Promise<Movement[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('movements').select('*').order('created_at', { ascending: false }).limit(50);
    if (!error && data) {
      return data.map((m: any) => ({
        id: m.id,
        date: m.created_at,
        prodId: m.prod_id,
        prodName: m.prod_name,
        qty: m.qty,
        obs: m.obs
      }));
    }
  }
  const local = localStorage.getItem(LS_MOVEMENTS);
  return local ? JSON.parse(local) : [];
};

export const saveMovement = async (movement: Movement): Promise<void> => {
  if (supabase) {
    const { error } = await supabase.from('movements').insert([{
      prod_id: movement.prodId,
      prod_name: movement.prodName,
      qty: movement.qty,
      obs: movement.obs,
      created_at: movement.date 
    }]);
    if (error) throw new Error(error.message);
  } else {
    const movements = await fetchMovements();
    movements.unshift(movement);
    localStorage.setItem(LS_MOVEMENTS, JSON.stringify(movements));
  }
};

export const clearLocalHistory = () => {
    localStorage.removeItem(LS_MOVEMENTS);
};