import { createClient, SupabaseClient } from '@supabase/supabase-js';
<<<<<<< HEAD
import { Product, Movement, Order, SyncItem, OrderItem } from '../types';
=======
import { Product, Movement, SupabaseConfig, Order, SyncItem } from '../types';
>>>>>>> b9e5aa8f7b4227e66e8d1853e5cef217ed572511

const LS_PRODUCTS = 'stock_products';
const LS_MOVEMENTS = 'stock_movements';
const LS_ORDERS = 'stock_orders';
const LS_SYNC_QUEUE = 'stock_sync_queue';

<<<<<<< HEAD
// --- CONFIGURAÇÃO BANCO DE ESTOQUE (ORIGINAL - PRODUTOS E MOVIMENTAÇÕES) ---
const INV_URL = 'https://fnhapvoxgqkzokravccd.supabase.co';
const INV_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaGFwdm94Z3Frem9rcmF2Y2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU5ODksImV4cCI6MjA4MDgwMTk4OX0.xmZ4F4Zwc4azBr5niczcD9ct37CnTsPb1IFCTKhZ-Bw';

// --- CONFIGURAÇÃO BANCO DE PEDIDOS (NOVO - SITE) ---
const ORD_URL = 'https://cqsnjllremfqrvebqrgo.supabase.co';
const ORD_KEY = 'sb_publishable_d0nr0JLUeaoooxrJxq21OA_C6DMWh8s';

let supabaseInventory: SupabaseClient;
let supabaseOrders: SupabaseClient;

export const initDatabase = (): boolean => {
  try {
    // Inicializa cliente do Estoque
    if (INV_URL && INV_KEY) {
        supabaseInventory = createClient(INV_URL, INV_KEY);
    }
    // Inicializa cliente de Pedidos
    if (ORD_URL && ORD_KEY) {
        supabaseOrders = createClient(ORD_URL, ORD_KEY);
    }
    return true;
  } catch (e) {
    console.error('Erro ao inicializar Supabase Clients:', e);
    return false;
  }
=======
// --- CONFIGURAÇÃO DE CONEXÃO ---
// COLOQUE SUAS CREDENCIAIS AQUI PARA CONEXÃO AUTOMÁTICA
const DEFAULT_URL = 'https://fnhapvoxgqkzokravccd.supabase.co'; 
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaGFwdm94Z3Frem9rcmF2Y2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU5ODksImV4cCI6MjA4MDgwMTk4OX0.xmZ4F4Zwc4azBr5niczcD9ct37CnTsPb1IFCTKhZ-Bw'; 

let supabase: SupabaseClient | null = null;

// Initialize Supabase automatically
export const initSupabase = (): boolean => {
  if (DEFAULT_URL && DEFAULT_KEY) {
    try {
      supabase = createClient(DEFAULT_URL, DEFAULT_KEY);
      return true;
    } catch (e) {
      console.error("Failed to init supabase", e);
      return false;
    }
  }
  return false;
};

export const getSupabaseConfig = (): SupabaseConfig => ({
  url: DEFAULT_URL ? 'Configurado no Código' : '',
  key: DEFAULT_KEY ? '******' : ''
});

export const clearSupabaseConfig = () => {
  supabase = null;
>>>>>>> b9e5aa8f7b4227e66e8d1853e5cef217ed572511
};

// --- SYNC QUEUE MANAGEMENT ---

const addToSyncQueue = (item: Omit<SyncItem, 'timestamp'>) => {
  const queueJson = localStorage.getItem(LS_SYNC_QUEUE);
  const queue: SyncItem[] = queueJson ? JSON.parse(queueJson) : [];
<<<<<<< HEAD
  queue.push({ ...item, timestamp: Date.now() });
=======
  
  // Adiciona novo item
  queue.push({ ...item, timestamp: Date.now() });
  
>>>>>>> b9e5aa8f7b4227e66e8d1853e5cef217ed572511
  localStorage.setItem(LS_SYNC_QUEUE, JSON.stringify(queue));
};

export const getPendingSyncCount = (): number => {
  const queueJson = localStorage.getItem(LS_SYNC_QUEUE);
<<<<<<< HEAD
  if (!queueJson) return 0;
  try {
    return JSON.parse(queueJson).length;
  } catch {
    return 0;
  }
};

export const processSyncQueue = async (): Promise<string> => {
  const queueJson = localStorage.getItem(LS_SYNC_QUEUE);
  if (!queueJson) return 'Vazio';

  const queue: SyncItem[] = JSON.parse(queueJson);
  if (queue.length === 0) return 'Vazio';
=======
  return queueJson ? JSON.parse(queueJson).length : 0;
};

// Processa a fila enviando dados para o Supabase
export const processSyncQueue = async (): Promise<string> => {
  if (!supabase) return 'Offline';

  const queueJson = localStorage.getItem(LS_SYNC_QUEUE);
  if (!queueJson) return 'Empty';

  const queue: SyncItem[] = JSON.parse(queueJson);
  if (queue.length === 0) return 'Empty';
>>>>>>> b9e5aa8f7b4227e66e8d1853e5cef217ed572511

  let successCount = 0;
  const failedItems: SyncItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'PRODUCT') {
<<<<<<< HEAD
         await saveProduct(item.payload, item.isNew || false, true);
=======
         await saveProduct(item.payload, item.isNew || false, true); // true = skipLocalSave (force remote)
>>>>>>> b9e5aa8f7b4227e66e8d1853e5cef217ed572511
      } else if (item.type === 'MOVEMENT') {
         await saveMovement(item.payload, true);
      } else if (item.type === 'ORDER') {
         await saveOrder(item.payload, item.isNew || false, true);
      } else if (item.type === 'DELETE_ORDER') {
         await deleteOrder(item.payload, true);
      }
      successCount++;
    } catch (e) {
<<<<<<< HEAD
      console.error("Sync failed for item:", item.id, e);
=======
      console.error("Sync failed for item", item, e);
      // Se falhar, mantemos na fila para tentar depois (ou implementamos lógica de descarte)
      // Por enquanto, vamos manter na fila se for erro de rede, mas descartar se for erro de dados
      // Simplificação: Mantém na fila de falhas
>>>>>>> b9e5aa8f7b4227e66e8d1853e5cef217ed572511
      failedItems.push(item);
    }
  }

<<<<<<< HEAD
=======
  // Atualiza a fila apenas com os itens que falharam
>>>>>>> b9e5aa8f7b4227e66e8d1853e5cef217ed572511
  if (failedItems.length > 0) {
      localStorage.setItem(LS_SYNC_QUEUE, JSON.stringify(failedItems));
  } else {
      localStorage.removeItem(LS_SYNC_QUEUE);
  }

  return `Sincronizados ${successCount} itens.`;
};

<<<<<<< HEAD
// --- DATA METHODS (INVENTORY DB) ---

export const fetchProducts = async (): Promise<Product[]> => {
  try {
    // Usa supabaseInventory
    const { data, error } = await supabaseInventory
      .from('products')
      .select('*')
      .order('name');
    
    if (error) throw error;
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(data));
    return data || [];
  } catch (e) {
    // console.error("Erro fetchProducts", e); // Silencioso para fallback offline
    const local = localStorage.getItem(LS_PRODUCTS);
    return local ? JSON.parse(local) : [];
  }
};

export const saveProduct = async (product: Product, isNew: boolean, skipLocal: boolean = false): Promise<void> => {
  try {
    let error;
    // Usa supabaseInventory
    if (isNew) {
      ({ error } = await supabaseInventory.from('products').insert([product]));
    } else {
      ({ error } = await supabaseInventory
        .from('products')
        .update({ qty: product.qty })
        .eq('id', product.id));
    }
    if (error) throw error;
  } catch (e) {
    if (!skipLocal) {
        addToSyncQueue({ type: 'PRODUCT', action: 'SAVE', payload: product, isNew, id: product.id });
    }
    throw e;
  } 
  
  if (!skipLocal) {
    const localProducts = JSON.parse(localStorage.getItem(LS_PRODUCTS) || '[]');
    let newProducts = [...localProducts];
    const idx = newProducts.findIndex(p => p.id === product.id);
    if (idx !== -1) {
        newProducts[idx] = product;
    } else {
        newProducts.unshift(product);
=======
// --- DATA METHODS ---

export const fetchProducts = async (): Promise<Product[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (!error && data) {
        return data.map((p: any) => ({
            ...p,
            id: Array.isArray(p.id) ? p.id[0] : p.id
        }));
    }
  }
  const local = localStorage.getItem(LS_PRODUCTS);
  return local ? JSON.parse(local) : [];
};

// Adicionado flag `skipLocal` para evitar loop infinito durante o sync
export const saveProduct = async (product: Product, isNew: boolean, skipLocal: boolean = false): Promise<void> => {
  if (supabase) {
    if (isNew) {
      let { error } = await supabase.from('products').insert([product]);
      if (error && error.message && error.message.includes('malformed array literal')) {
          const retryPayload = { ...product, id: [product.id] };
          const retry = await supabase.from('products').insert([retryPayload]);
          if (retry.error) throw new Error(retry.error.message);
      } else if (error) {
          throw new Error(error.message);
      }
    } else {
      // Upsert é mais seguro para sync
      const { error } = await supabase.from('products').upsert(product);
      if (error) throw new Error(error.message);
    }
  } 
  
  if (!skipLocal) {
    // Se não tem supabase (offline), adiciona na fila
    if (!supabase) {
        addToSyncQueue({ type: 'PRODUCT', action: 'SAVE', payload: product, isNew, id: product.id });
    }

    // Sempre salva localmente para UI ficar rápida
    const products = await fetchProductsFallback(); // Função auxiliar para ler do storage
    let newProducts = [...products];
    if (isNew) {
        // Verifica duplicidade apenas se não for sync
        if (!supabase && products.find(p => p.id === product.id)) throw new Error("Produto já existe offline!");
        // Se for sync, pode ser que já exista, então tratamos como update no array local
        if (products.find(p => p.id === product.id)) {
             newProducts = products.map(p => p.id === product.id ? product : p);
        } else {
             newProducts.unshift(product);
        }
    } else {
      newProducts = products.map(p => p.id === product.id ? product : p);
>>>>>>> b9e5aa8f7b4227e66e8d1853e5cef217ed572511
    }
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(newProducts));
  }
};

<<<<<<< HEAD
export const fetchMovements = async (): Promise<Movement[]> => {
  try {
    // Usa supabaseInventory
    const { data, error } = await supabaseInventory
      .from('movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    
    if (error) throw error;
    
    const formatted = data.map((m: any) => ({
        id: m.id,
        date: m.created_at,
        prodId: m.prod_id,
        prodName: m.prod_name,
        qty: m.qty,
        obs: m.obs,
        matricula: m.matricula
    }));
    
    localStorage.setItem(LS_MOVEMENTS, JSON.stringify(formatted));
    return formatted;
  } catch (e) {
    const local = localStorage.getItem(LS_MOVEMENTS);
    return local ? JSON.parse(local) : [];
  }
};

export const saveMovement = async (movement: Movement, skipLocal: boolean = false): Promise<void> => {
  try {
    // Usa supabaseInventory
    const { error } = await supabaseInventory.from('movements').insert([{
        prod_id: movement.prodId,
        prod_name: movement.prodName,
        qty: movement.qty,
        obs: movement.obs,
        matricula: movement.matricula,
        created_at: movement.date
    }]);
    if (error) throw error;
  } catch (e) {
    if (!skipLocal) {
        addToSyncQueue({ type: 'MOVEMENT', action: 'SAVE', payload: movement, id: movement.id });
    }
    throw e;
  } 
  
  if (!skipLocal) {
    const localMovements = JSON.parse(localStorage.getItem(LS_MOVEMENTS) || '[]');
    localMovements.unshift(movement);
    localStorage.setItem(LS_MOVEMENTS, JSON.stringify(localMovements));
  }
};

export const deleteAllMovements = async (): Promise<void> => {
    try {
        // Usa supabaseInventory
        const { error } = await supabaseInventory.from('movements').delete().neq('id', 0);
        if (error) throw error;
    } catch (e) {
        console.error(e);
    }
    localStorage.removeItem(LS_MOVEMENTS);
};

// --- ORDER METHODS (ORDERS DB - SITE) ---

export const fetchOrders = async (): Promise<Order[]> => {
  try {
    // 1. Busca pedidos do banco do site
    const { data, error } = await supabaseOrders
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // 2. Prepara dados locais para manter progresso de separação
    const localOrdersStr = localStorage.getItem(LS_ORDERS);
    const localOrders: Order[] = localOrdersStr ? JSON.parse(localOrdersStr) : [];
    const localMap = new Map(localOrders.map(o => [o.id, o]));

    // 3. RECUPERA PRODUTOS DO ESTOQUE PARA CRUZAR DADOS VIA SKU (Nome)
    const localProductsStr = localStorage.getItem(LS_PRODUCTS);
    const productsList: Product[] = localProductsStr ? JSON.parse(localProductsStr) : [];
    
    // Cria Map normalizando as chaves para string e sem espaços
    const productMap = new Map<string, string>();
    productsList.forEach(p => {
        if(p.id) productMap.set(String(p.id).trim(), p.name);
    });

    const formatted: Order[] = data.map((o: any) => {
        const localOrder = localMap.get(o.id);
        
        const items: OrderItem[] = (o.order_items || []).map((item: any) => {
            // Lógica robusta para encontrar o SKU
            // Tenta pegar 'sku', se nulo pega 'product_id', se nulo pega 'id'
            const rawSku = item.sku ?? item.product_id ?? item.id;
            
            // Normaliza para string e remove espaços para garantir match com o Map
            const sku = rawSku ? String(rawSku).trim() : 'N/A';
            
            // Tenta achar o nome no mapa de produtos pelo SKU normalizado.
            const catalogName = productMap.get(sku);
            
            // Se achou no estoque, usa. Se não, tenta usar o nome que veio no pedido. Se não, fallback.
            const pName = catalogName || item.product_name || `Produto SKU: ${sku}`;

            // Preserva contagem local
            // Precisamos garantir que a comparação aqui também seja robusta
            const localItem = localOrder?.items.find((li: OrderItem) => String(li.productId).trim() === sku);
            
            return {
                productId: sku,
                productName: pName,
                qtyRequested: item.quantity || 0,
                qtyPicked: localItem ? localItem.qtyPicked : 0 
            };
        });

        // FORMATAÇÃO DO MÉTODO DE PAGAMENTO
        // 1. Limpa underscores (ex: CARTAO_QUERO_QUERO -> CARTAO QUERO QUERO)
        const paymentInfo = (o.payment_method || '').replace(/_/g, ' ');

        // 2. Busca agressiva pelos 4 últimos dígitos em colunas comuns (Adicionado card_last_digits)
        let last4 = o.card_last_digits || o.card_last4 || o.last4 || o.last_4 || o.card_last_four || o.card_digits;

        if (!last4 && o.card_number) {
            // Fallback caso venha num campo 'card_number'
            const nums = String(o.card_number).replace(/\D/g, '');
            if(nums.length >= 4) last4 = nums.slice(-4);
        } else if (!last4 && typeof o.payment_details === 'object' && o.payment_details?.last4) {
            // Fallback para coluna JSON payment_details (comum em gateways)
            last4 = o.payment_details.last4;
        }

        return {
            id: o.id,
            orderNumber: o.ticket_number ? o.ticket_number.toString() : (o.order_number || 'SEM-NUM'),
            customerName: o.full_name || o.customer_name || 'Cliente Site',
            filial: o.segmento || o.filial || '',
            matricula: o.matricula || '',
            date: o.created_at || new Date().toISOString(),
            status: o.status === 'completed' ? 'completed' : 'pending',
            items: items,
            obs: o.obs || '',
            // Mapeando novos campos
            whatsapp: o.whatsapp || o.phone || '',
            paymentMethod: paymentInfo,
            cardLast4: last4 || '',
            
            envioMalote: localOrder ? localOrder.envioMalote : false,
            entregaMatriz: localOrder ? localOrder.entregaMatriz : false
        };
    });
    
    localStorage.setItem(LS_ORDERS, JSON.stringify(formatted));
    return formatted;
  } catch (e) {
    console.error("Erro ao buscar pedidos (Orders DB):", e);
    const local = localStorage.getItem(LS_ORDERS);
    return local ? JSON.parse(local) : [];
  }
};

export const saveOrder = async (order: Order, isNew: boolean, skipLocal: boolean = false): Promise<void> => {
  try {
    let error;

    const orderPayload = {
        ticket_number: parseInt(order.orderNumber) || 0,
        full_name: order.customerName,
        matricula: order.matricula,
        segmento: order.filial, 
        status: order.status,
        // Novos campos
        payment_method: order.paymentMethod,
        card_last_digits: order.cardLast4, // Corrigido para card_last_digits
        whatsapp: order.whatsapp,
    };

    if (isNew) {
      // Usa supabaseOrders
      const { error: orderError } = await supabaseOrders
        .from('orders')
        .insert([{ ...orderPayload, id: order.id }]);
      
      if (orderError) throw orderError;

      if (order.items.length > 0) {
          const itemsPayload = order.items.map(item => ({
              order_id: order.id,
              product_id: item.productId,
              product_name: item.productName,
              quantity: item.qtyRequested,
              sku: item.productId // Garante que o SKU seja salvo
          }));
          
          // Usa supabaseOrders
          const { error: itemsError } = await supabaseOrders
            .from('order_items')
            .insert(itemsPayload);
            
          if (itemsError) throw itemsError;
      }

    } else {
      // Usa supabaseOrders para atualizar Status e campos editados
      ({ error } = await supabaseOrders
        .from('orders')
        .update({ 
            status: order.status,
            payment_method: order.paymentMethod,
            card_last_digits: order.cardLast4, // Corrigido para card_last_digits
            whatsapp: order.whatsapp
        }) 
        .eq('id', order.id));
    }
    
    if (error) throw error;

  } catch (e) {
    if (!skipLocal) {
        addToSyncQueue({ type: 'ORDER', action: 'SAVE', payload: order, isNew, id: order.id });
    }
    throw e;
  } 
  
  if (!skipLocal) {
    const localOrders = JSON.parse(localStorage.getItem(LS_ORDERS) || '[]');
    let newOrders = [...localOrders];
    const idx = newOrders.findIndex(o => o.id === order.id);
    if (idx !== -1) {
        newOrders[idx] = order;
    } else {
        newOrders.unshift(order);
    }
=======
// Helper para ler local storage sem tentar bater no supabase
const fetchProductsFallback = async (): Promise<Product[]> => {
    const local = localStorage.getItem(LS_PRODUCTS);
    return local ? JSON.parse(local) : [];
};

export const fetchMovements = async (): Promise<Movement[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('movements').select('*').order('created_at', { ascending: false }).limit(200);
    if (!error && data) {
      return data.map((m: any) => {
        let matricula = m.matricula;
        let obs = m.obs;
        const rawProdId = m.prod_id;
        const prodId = Array.isArray(rawProdId) ? (rawProdId[0] || null) : (rawProdId || null);

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

export const saveMovement = async (movement: Movement, skipLocal: boolean = false): Promise<void> => {
  if (supabase) {
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

    if (error && error.message && error.message.includes('malformed array literal')) {
        const retryVal = movement.prodId ? [movement.prodId] : [];
        const retryPayload = { ...payload, prod_id: retryVal };
        const retry = await supabase.from('movements').insert([retryPayload]);
        if (retry.error) throw new Error(retry.error.message);
    } else if (error) {
        throw new Error(error.message);
    }

  } 
  
  if (!skipLocal) {
    if (!supabase) {
        addToSyncQueue({ type: 'MOVEMENT', action: 'SAVE', payload: movement, id: movement.id });
    }

    const movements = await fetchMovementsFallback();
    movements.unshift(movement);
    localStorage.setItem(LS_MOVEMENTS, JSON.stringify(movements));
  }
};

const fetchMovementsFallback = async (): Promise<Movement[]> => {
    const local = localStorage.getItem(LS_MOVEMENTS);
    return local ? JSON.parse(local) : [];
};

export const clearLocalHistory = () => {
    localStorage.removeItem(LS_MOVEMENTS);
};

export const deleteAllMovements = async (): Promise<void> => {
    if (supabase) {
        const { error } = await supabase.from('movements').delete().lte('created_at', '3000-01-01');
        if (error) throw new Error(error.message);
    }
    clearLocalHistory();
};

// --- ORDER METHODS ---

export const fetchOrders = async (): Promise<Order[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('orders').select('*').order('date', { ascending: false });
    if (!error && data) {
      return data.map((o: any) => {
        const envioMalote = o.envio_malote === true;
        const entregaMatriz = o.entrega_matriz === true;
        let status = o.status;
        if (status === 'completed' && !envioMalote && !entregaMatriz) status = 'pending';

        return {
          id: o.id,
          orderNumber: o.order_number,
          customerName: o.customer_name,
          filial: o.filial || '',
          matricula: o.matricula,
          date: o.date,
          status: status,
          items: o.items || [],
          obs: o.obs,
          envioMalote: envioMalote,
          entregaMatriz: entregaMatriz 
        };
      });
    }
  }
  const local = localStorage.getItem(LS_ORDERS);
  if (local) {
      const orders = JSON.parse(local);
      return orders.map((o: any) => ({
          ...o,
          status: (o.status === 'completed' && !o.envioMalote && !o.entregaMatriz) ? 'pending' : o.status
      }));
  }
  return [];
};

export const saveOrder = async (order: Order, isNew: boolean, skipLocal: boolean = false): Promise<void> => {
  if (supabase) {
    const payload = {
      order_number: order.orderNumber,
      customer_name: order.customerName,
      filial: order.filial, 
      matricula: order.matricula,
      date: order.date,
      status: order.status,
      items: order.items,
      obs: order.obs,
      envio_malote: order.envioMalote === true, 
      entrega_matriz: order.entregaMatriz === true
    };

    if (isNew) {
      // Usamos upsert aqui também para evitar conflitos de sync se o ID já existir
      const { error } = await supabase.from('orders').upsert([{ ...payload, id: order.id }]);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('orders').update(payload).eq('id', order.id);
      if (error) throw new Error(error.message);
    }
  } 
  
  if (!skipLocal) {
    if (!supabase) {
        addToSyncQueue({ type: 'ORDER', action: 'SAVE', payload: order, isNew, id: order.id });
    }

    const orders = await fetchOrdersFallback();
    let newOrders = [...orders];
    
    // Logic to update local array
    const exists = newOrders.find(o => o.id === order.id);
    if (exists) {
        newOrders = newOrders.map(o => o.id === order.id ? order : o);
    } else {
        newOrders.unshift(order);
    }
    
>>>>>>> b9e5aa8f7b4227e66e8d1853e5cef217ed572511
    localStorage.setItem(LS_ORDERS, JSON.stringify(newOrders));
  }
};

<<<<<<< HEAD
export const deleteOrder = async (id: string, skipLocal: boolean = false): Promise<void> => {
    try {
        // Usa supabaseOrders
        const { error } = await supabaseOrders.from('orders').delete().eq('id', id);
        if (error) throw error;
    } catch (e) {
        if (!skipLocal) {
            addToSyncQueue({ type: 'DELETE_ORDER', action: 'DELETE', payload: id, id: id });
        }
        throw e;
    } 
    
    if (!skipLocal) {
        const localOrders = JSON.parse(localStorage.getItem(LS_ORDERS) || '[]');
        const newOrders = localOrders.filter((o: any) => o.id !== id);
=======
const fetchOrdersFallback = async (): Promise<Order[]> => {
    const local = localStorage.getItem(LS_ORDERS);
    return local ? JSON.parse(local) : [];
};

export const deleteOrder = async (id: string, skipLocal: boolean = false): Promise<void> => {
    if (supabase) {
        const { error } = await supabase.from('orders').delete().eq('id', id);
        if (error) throw new Error(error.message);
    } 
    
    if (!skipLocal) {
        if (!supabase) {
            addToSyncQueue({ type: 'DELETE_ORDER', action: 'DELETE', payload: id, id: id });
        }

        const orders = await fetchOrdersFallback();
        const newOrders = orders.filter(o => o.id !== id);
>>>>>>> b9e5aa8f7b4227e66e8d1853e5cef217ed572511
        localStorage.setItem(LS_ORDERS, JSON.stringify(newOrders));
    }
};