import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Movement, Order, SyncItem, OrderItem } from '../types';

const LS_PRODUCTS = 'stock_products';
const LS_MOVEMENTS = 'stock_movements';
const LS_ORDERS = 'stock_orders';
const LS_SYNC_QUEUE = 'stock_sync_queue';

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
};

export const testConnection = async (): Promise<{inventory: boolean, orders: boolean}> => {
    let inventory = false;
    let orders = false;
    
    try {
        if (supabaseInventory) {
            const { error } = await supabaseInventory.from('products').select('id').limit(1);
            inventory = !error;
        }
    } catch (e) { console.error('Inv Check Error', e); }

    try {
        if (supabaseOrders) {
             const { error } = await supabaseOrders.from('orders').select('id').limit(1);
             orders = !error;
        }
    } catch (e) { console.error('Ord Check Error', e); }

    return { inventory, orders };
};

// --- SYNC QUEUE MANAGEMENT ---

const addToSyncQueue = (item: Omit<SyncItem, 'timestamp'>) => {
  const queueJson = localStorage.getItem(LS_SYNC_QUEUE);
  const queue: SyncItem[] = queueJson ? JSON.parse(queueJson) : [];
  queue.push({ ...item, timestamp: Date.now() });
  localStorage.setItem(LS_SYNC_QUEUE, JSON.stringify(queue));
};

export const getPendingSyncCount = (): number => {
  const queueJson = localStorage.getItem(LS_SYNC_QUEUE);
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

  let successCount = 0;
  const failedItems: SyncItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'PRODUCT') {
         await saveProduct(item.payload, item.isNew || false, true);
      } else if (item.type === 'MOVEMENT') {
         await saveMovement(item.payload, true);
      } else if (item.type === 'ORDER') {
         await saveOrder(item.payload, item.isNew || false, true);
      } else if (item.type === 'DELETE_ORDER') {
         await deleteOrder(item.payload, true);
      }
      successCount++;
    } catch (e) {
      console.error("Sync failed for item:", item.id, e);
      failedItems.push(item);
    }
  }

  if (failedItems.length > 0) {
      localStorage.setItem(LS_SYNC_QUEUE, JSON.stringify(failedItems));
  } else {
      localStorage.removeItem(LS_SYNC_QUEUE);
  }

  return `Sincronizados ${successCount} itens.`;
};

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
    }
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(newProducts));
  }
};

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
    localStorage.setItem(LS_ORDERS, JSON.stringify(newOrders));
  }
};

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
        localStorage.setItem(LS_ORDERS, JSON.stringify(newOrders));
    }
};