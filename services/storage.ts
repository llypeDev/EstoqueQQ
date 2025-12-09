import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Movement, SupabaseConfig, Order } from '../types';

const LS_PRODUCTS = 'stock_products';
const LS_MOVEMENTS = 'stock_movements';
const LS_ORDERS = 'stock_orders';
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
    if (!error && data) {
        // Normaliza dados caso ID seja retornado como array (erro de schema)
        return data.map((p: any) => ({
            ...p,
            id: Array.isArray(p.id) ? p.id[0] : p.id
        }));
    }
  }
  const local = localStorage.getItem(LS_PRODUCTS);
  return local ? JSON.parse(local) : [];
};

export const saveProduct = async (product: Product, isNew: boolean): Promise<void> => {
  if (supabase) {
    if (isNew) {
      let { error } = await supabase.from('products').insert([product]);
      
      // Tentativa de correção se 'id' for array
      if (error && error.message && error.message.includes('malformed array literal')) {
          const retryPayload = { ...product, id: [product.id] };
          const retry = await supabase.from('products').insert([retryPayload]);
          if (retry.error) throw new Error(retry.error.message);
      } else if (error) {
          throw new Error(error.message);
      }
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
    // Aumentado limit para 200 para facilitar o filtro de datas
    const { data, error } = await supabase.from('movements').select('*').order('created_at', { ascending: false }).limit(200);
    if (!error && data) {
      return data.map((m: any) => {
        // Tenta extrair a matrícula do campo obs caso a coluna não exista no banco
        let matricula = m.matricula;
        let obs = m.obs;

        // Normaliza prod_id caso venha como array
        const rawProdId = m.prod_id;
        const prodId = Array.isArray(rawProdId) ? (rawProdId[0] || '') : rawProdId;

        if (!matricula && obs && typeof obs === 'string' && obs.startsWith('[Mat:')) {
            const match = obs.match(/^\[Mat: (.+?)\]\s*(.*)$/);
            if (match) {
                matricula = match[1];
                obs = match[2];
            }
        }

        return {
          id: m.id,
          date: m.created_at,
          prodId: prodId,
          prodName: m.prod_name,
          qty: m.qty,
          obs: obs,
          matricula: matricula
        };
      });
    }
  }
  const local = localStorage.getItem(LS_MOVEMENTS);
  return local ? JSON.parse(local) : [];
};

export const saveMovement = async (movement: Movement): Promise<void> => {
  if (supabase) {
    // Workaround: Como a coluna 'matricula' pode não existir no banco,
    // salvamos dentro do campo 'obs' formatado.
    const obsWithMatricula = movement.matricula 
        ? `[Mat: ${movement.matricula}] ${movement.obs || ''}`.trim() 
        : movement.obs;

    const payload = {
      prod_id: movement.prodId,
      prod_name: movement.prodName,
      qty: movement.qty,
      obs: obsWithMatricula,
      created_at: movement.date 
    };

    let { error } = await supabase.from('movements').insert([payload]);

    // Retry logic: Se o banco reclamar de "malformed array literal", 
    // é provável que prod_id seja text[] (array). Tentamos enviar como array.
    if (error && error.message && error.message.includes('malformed array literal')) {
        console.warn("Retrying insert with array prod_id due to schema mismatch.");
        const retryPayload = { ...payload, prod_id: [movement.prodId] };
        const retry = await supabase.from('movements').insert([retryPayload]);
        if (retry.error) throw new Error(retry.error.message);
    } else if (error) {
        throw new Error(error.message);
    }

  } else {
    const movements = await fetchMovements();
    movements.unshift(movement);
    localStorage.setItem(LS_MOVEMENTS, JSON.stringify(movements));
  }
};

export const clearLocalHistory = () => {
    localStorage.removeItem(LS_MOVEMENTS);
};

export const deleteAllMovements = async (): Promise<void> => {
    if (supabase) {
        // Usa filtro por data (created_at <= ano 3000) para garantir que funcione
        // tanto com IDs numéricos quanto UUIDs, evitando erro de tipo.
        const { error } = await supabase.from('movements').delete().lte('created_at', '3000-01-01');
        
        if (error) {
            console.error("Supabase Delete Error:", error);
            throw new Error(error.message);
        }
    }
    // Limpa local também
    clearLocalHistory();
};

// --- ORDER METHODS ---

export const fetchOrders = async (): Promise<Order[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('orders').select('*').order('date', { ascending: false });
    if (!error && data) {
      return data.map((o: any) => ({
        id: o.id,
        orderNumber: o.order_number,
        customerName: o.customer_name,
        matricula: o.matricula,
        date: o.date,
        status: o.status,
        items: o.items || [], // JSON column
        obs: o.obs
      }));
    }
  }
  const local = localStorage.getItem(LS_ORDERS);
  return local ? JSON.parse(local) : [];
};

export const saveOrder = async (order: Order, isNew: boolean): Promise<void> => {
  if (supabase) {
    const payload = {
      order_number: order.orderNumber,
      customer_name: order.customerName,
      matricula: order.matricula,
      date: order.date,
      status: order.status,
      items: order.items,
      obs: order.obs
    };

    if (isNew) {
      // Supabase gera ID automaticamente se for UUID, mas se quisermos controlar:
      // Vamos deixar o supabase gerar o ID se a coluna for uuid default gen
      // Se a tabela não existir, vai cair no catch do App
      const { error } = await supabase.from('orders').insert([{ ...payload, id: order.id }]);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('orders').update(payload).eq('id', order.id);
      if (error) throw new Error(error.message);
    }
  } else {
    const orders = await fetchOrders();
    let newOrders = [...orders];
    if (isNew) {
      newOrders.unshift(order);
    } else {
      newOrders = orders.map(o => o.id === order.id ? order : o);
    }
    localStorage.setItem(LS_ORDERS, JSON.stringify(newOrders));
  }
};

export const deleteOrder = async (id: string): Promise<void> => {
    if (supabase) {
        const { error } = await supabase.from('orders').delete().eq('id', id);
        if (error) throw new Error(error.message);
    } else {
        const orders = await fetchOrders();
        const newOrders = orders.filter(o => o.id !== id);
        localStorage.setItem(LS_ORDERS, JSON.stringify(newOrders));
    }
};