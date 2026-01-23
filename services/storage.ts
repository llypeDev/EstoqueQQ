import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Product, Movement, Order, OrderItem } from '../types';

const LS_PRODUCTS = 'stock_products';
const LS_MOVEMENTS = 'stock_movements';
const LS_ORDERS = 'stock_orders';

// --- CONFIGURAÇÃO BANCO DE ESTOQUE ---
const INV_URL = 'https://fnhapvoxgqkzokravccd.supabase.co';
const INV_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuaGFwdm94Z3Frem9rcmF2Y2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU5ODksImV4cCI6MjA4MDgwMTk4OX0.xmZ4F4Zwc4azBr5niczcD9ct37CnTsPb1IFCTKhZ-Bw';

// --- CONFIGURAÇÃO BANCO DE PEDIDOS ---
const ORD_URL = 'https://cqsnjllremfqrvebqrgo.supabase.co';
const ORD_KEY = 'sb_publishable_d0nr0JLUeaoooxrJxq21OA_C6DMWh8s';

let supabaseInventory: SupabaseClient;
let supabaseOrders: SupabaseClient;

export const initDatabase = (): boolean => {
  try {
    if (INV_URL && INV_KEY) supabaseInventory = createClient(INV_URL, INV_KEY);
    if (ORD_URL && ORD_KEY) supabaseOrders = createClient(ORD_URL, ORD_KEY);
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

// --- DATA METHODS (INVENTORY DB) ---

export const fetchProducts = async (): Promise<Product[]> => {
  try {
    const { data, error } = await supabaseInventory
      .from('products')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    // Atualiza o cache de leitura APENAS se o banco responder com sucesso
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(data || []));
    return data || [];
  } catch (e) {
    console.error("Erro ao buscar produtos:", e);
    // Fallback apenas para leitura se estiver sem internet
    const local = localStorage.getItem(LS_PRODUCTS);
    return local ? JSON.parse(local) : [];
  }
};

export const saveProduct = async (product: Product, isNew: boolean): Promise<void> => {
  // SOMENTE BANCO DE DADOS - Sem fallback local
  let error;
  if (isNew) {
    ({ error } = await supabaseInventory.from('products').insert([product]));
  } else {
    ({ error } = await supabaseInventory
      .from('products')
      .update({ qty: product.qty })
      .eq('id', product.id));
  }
  
  if (error) throw error;
};

export const fetchMovements = async (): Promise<Movement[]> => {
  try {
    const { data, error } = await supabaseInventory
      .from('movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    
    if (error) throw error;
    
    const formatted: Movement[] = data.map((m: any) => ({
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
    console.error("Erro ao buscar movimentos:", e);
    const local = localStorage.getItem(LS_MOVEMENTS);
    return local ? JSON.parse(local) : [];
  }
};

export const saveMovement = async (movement: Movement): Promise<void> => {
  // SOMENTE BANCO DE DADOS
  const { error } = await supabaseInventory.from('movements').insert([{
      prod_id: movement.prodId,
      prod_name: movement.prodName,
      qty: movement.qty,
      obs: movement.obs,
      matricula: movement.matricula,
      created_at: movement.date
  }]);
  
  if (error) throw error;
};

export const deleteAllMovements = async (): Promise<void> => {
    // Apaga do banco
    const { error } = await supabaseInventory.from('movements').delete().neq('id', 0);
    if (error) throw error;
    
    // Se sucesso, limpa cache visual
    localStorage.removeItem(LS_MOVEMENTS);
};

// --- ORDER METHODS (ORDERS DB - SITE) ---

export const fetchOrders = async (): Promise<Order[]> => {
  try {
    const { data, error } = await supabaseOrders
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Recupera dados auxiliares locais apenas para compor nomes se necessário (cache de produtos)
    const localOrdersStr = localStorage.getItem(LS_ORDERS);
    const localOrders: Order[] = localOrdersStr ? JSON.parse(localOrdersStr) : [];
    const localMap = new Map(localOrders.map(o => [o.id, o]));
    const localProductsStr = localStorage.getItem(LS_PRODUCTS);
    const productsList: Product[] = localProductsStr ? JSON.parse(localProductsStr) : [];
    const productMap = new Map<string, string>();
    productsList.forEach(p => { if(p.id) productMap.set(String(p.id).trim(), p.name); });

    const formatted: Order[] = data.map((o: any) => {
        const localOrder = localMap.get(o.id);
        const items: OrderItem[] = (o.order_items || []).map((item: any) => {
            const rawSku = item.sku ?? item.product_id ?? item.id;
            const sku = rawSku ? String(rawSku).trim() : 'N/A';
            const catalogName = productMap.get(sku);
            const pName = catalogName || item.product_name || `Produto SKU: ${sku}`;
            
            // Tenta pegar qtyPicked do cache local temporariamente, ou 0
            // Idealmente isso deveria vir do banco se você implementar persistência de picking no banco
            // Como "order_items" não tem picked no seu schema original aparente, mantemos a lógica visual
            // Mas cuidado: se não salvar picked no banco, ao recarregar perde o progresso
            const localItem = localOrder?.items.find((li: OrderItem) => String(li.productId).trim() === sku);
            
            return {
                productId: sku,
                productName: pName,
                qtyRequested: item.quantity || 0,
                qtyPicked: localItem ? localItem.qtyPicked : 0 
            };
        });
        
        const paymentInfo = (o.payment_method || '').replace(/_/g, ' ');
        let last4 = o.card_last_digits || o.card_last4 || o.last4 || o.last_4 || o.card_last_four || o.card_digits;
        if (!last4 && o.card_number) {
            const nums = String(o.card_number).replace(/\D/g, '');
            if(nums.length >= 4) last4 = nums.slice(-4);
        } else if (!last4 && typeof o.payment_details === 'object' && o.payment_details?.last4) {
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
            whatsapp: o.whatsapp || o.phone || '',
            paymentMethod: paymentInfo,
            cardLast4: last4 || '',
            // Campos locais que não estão no banco original mantêm comportamento de cache
            envioMalote: localOrder ? localOrder.envioMalote : false,
            entregaMatriz: localOrder ? localOrder.entregaMatriz : false
        };
    });
    
    localStorage.setItem(LS_ORDERS, JSON.stringify(formatted));
    return formatted;
  } catch (e) {
    console.error("Erro ao buscar pedidos:", e);
    const local = localStorage.getItem(LS_ORDERS);
    return local ? JSON.parse(local) : [];
  }
};

export const saveOrder = async (order: Order, isNew: boolean): Promise<void> => {
    // SOMENTE BANCO DE DADOS
    let error;
    const orderPayload = {
        ticket_number: parseInt(order.orderNumber) || 0,
        full_name: order.customerName,
        matricula: order.matricula,
        segmento: order.filial, 
        status: order.status,
        payment_method: order.paymentMethod,
        card_last_digits: order.cardLast4,
        whatsapp: order.whatsapp,
    };
    
    if (isNew) {
      const { error: orderError } = await supabaseOrders.from('orders').insert([{ ...orderPayload, id: order.id }]);
      if (orderError) throw orderError;
      
      if (order.items.length > 0) {
          const itemsPayload = order.items.map(item => ({
              order_id: order.id,
              product_id: item.productId,
              product_name: item.productName,
              quantity: item.qtyRequested,
              sku: item.productId
          }));
          const { error: itemsError } = await supabaseOrders.from('order_items').insert(itemsPayload);
          if (itemsError) throw itemsError;
      }
    } else {
      ({ error } = await supabaseOrders.from('orders').update({ 
            status: order.status,
            payment_method: order.paymentMethod,
            card_last_digits: order.cardLast4,
            whatsapp: order.whatsapp
        }).eq('id', order.id));
    }
    
    if (error) throw error;
};

export const deleteOrder = async (id: string): Promise<void> => {
    // SOMENTE BANCO DE DADOS
    // 1. Apaga itens relacionados
    await supabaseOrders.from('order_items').delete().eq('order_id', id);
    // 2. Apaga o pedido
    const { error } = await supabaseOrders.from('orders').delete().eq('id', id);
    
    if (error) throw error;
};