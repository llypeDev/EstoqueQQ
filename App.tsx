// ... (imports remain the same)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Package, QrCode, ClipboardList, Plus, Search, Settings, 
  Database, Wifi, WifiOff, AlertTriangle, FileText, ArrowRight, Minus, 
  Trash2, Box, History, ArrowDown, ArrowUp, Calendar, ShoppingCart, 
  User, Hash, CheckSquare, Edit, X, RefreshCw, ScanLine, Upload, Truck, Building, Save, Activity
} from 'lucide-react';
import { Product, Movement, ViewState, ToastMessage, Order, OrderItem } from './types';
import * as storage from './services/storage';
import * as exporter from './utils/export';
import Scanner from './components/Scanner';
import QRModal from './components/modals/QRModal';
import Toast from './components/ui/Toast';

const App: React.FC = () => {
  // --- STATE ---
  const [view, setView] = useState<ViewState>('home');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showBaixa, setShowBaixa] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false); 
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState<'global' | 'order'>('global');
  
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showOrderPicking, setShowOrderPicking] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewQRProduct, setViewQRProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [newProdForm, setNewProdForm] = useState({ id: '', name: '', qty: '' });
  const [baixaForm, setBaixaForm] = useState({ qty: 1, obs: '', matricula: '' });
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('out');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const emptyOrderForm: Order = {
      id: '',
      orderNumber: '',
      customerName: '',
      filial: '',
      matricula: '',
      date: new Date().toISOString().slice(0, 10),
      status: 'pending',
      items: [],
      obs: '',
      envioMalote: false,
      entregaMatriz: false,
      whatsapp: '',
      paymentMethod: '',
      cardLast4: ''
  };
  const [orderForm, setOrderForm] = useState<Order>(emptyOrderForm);
  const [orderItemSearch, setOrderItemSearch] = useState('');

  const addToast = (type: ToastMessage['type'], text: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, text }]);
    setTimeout(() => removeToast(id), 3000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const prods = await storage.fetchProducts();
      const movs = await storage.fetchMovements();
      const ords = await storage.fetchOrders();
      setProducts(prods);
      setMovements(movs);
      setOrders(ords);
      setPendingSyncs(storage.getPendingSyncCount());
    } catch (e) {
      console.error(e);
      addToast('error', 'Erro ao carregar dados.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSync = async () => {
      setIsLoading(true);
      try {
          const res = await storage.processSyncQueue();
          addToast('info', res);
          await refreshData();
      } catch (e) {
          addToast('error', 'Falha na sincronização.');
      } finally {
          setIsLoading(false);
      }
  };

  const handleTestConnection = async () => {
      setIsLoading(true);
      try {
          const status = await storage.testConnection();
          const msg = [];
          if (status.inventory) msg.push('Estoque: OK'); else msg.push('Estoque: Falha');
          if (status.orders) msg.push('Pedidos: OK'); else msg.push('Pedidos: Falha');
          
          const type = (status.inventory && status.orders) ? 'success' : 'error';
          addToast(type, msg.join(' | '));
      } catch (e) {
          addToast('error', 'Erro ao testar conexão.');
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    storage.initDatabase();
    refreshData();

    const handleOnline = () => { setIsOnline(true); handleSync(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync inicial se houver internet
    if (navigator.onLine) handleSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshData]);

  const handleClearHistory = async () => {
      if (window.confirm('Deseja limpar o histórico? (Esta ação limpará o banco de dados remoto se online)')) {
          setIsLoading(true);
          try {
              await storage.deleteAllMovements();
              await refreshData();
              addToast('success', 'Histórico apagado.');
          } catch (e: any) {
              addToast('error', 'Erro ao apagar.');
          } finally {
              setIsLoading(false);
          }
      }
  };

  const handleSaveProduct = async () => {
    if (!newProdForm.id || !newProdForm.name) {
      addToast('error', 'Preencha código e nome.');
      return;
    }
    
    setIsLoading(true);
    try {
      const qty = parseInt(newProdForm.qty) || 0;
      await storage.saveProduct({ id: newProdForm.id, name: newProdForm.name, qty }, true);
      await refreshData();
      setShowAddProduct(false);
      setNewProdForm({ id: '', name: '', qty: '' });
      addToast('success', 'Produto salvo.');
    } catch (e: any) {
      addToast('info', 'Salvo localmente (aguardando sync).');
      refreshData();
      setShowAddProduct(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmTransaction = async () => {
    if (!selectedProduct) return;
    const qtyInput = baixaForm.qty;
    const isRemoval = transactionType === 'out';
    const finalQtyDelta = isRemoval ? -qtyInput : qtyInput;
    
    if (isRemoval && selectedProduct.qty < qtyInput) {
      addToast('error', 'Estoque insuficiente.');
      return;
    }

    if (!baixaForm.matricula.trim()) {
        addToast('error', 'Preencha a matrícula.');
        return;
    }

    setIsLoading(true);
    try {
      const newQty = selectedProduct.qty + finalQtyDelta;
      const updatedProd = { ...selectedProduct, qty: newQty };
      await storage.saveProduct(updatedProd, false);
      await storage.saveMovement({
        id: Date.now(),
        date: new Date().toISOString(),
        prodId: selectedProduct.id,
        prodName: selectedProduct.name,
        qty: finalQtyDelta, 
        obs: baixaForm.obs,
        matricula: baixaForm.matricula
      });
      await refreshData();
      setShowBaixa(false);
      setSelectedProduct(null);
      setBaixaForm({ qty: 1, obs: '', matricula: '' }); 
      addToast('success', 'Estoque atualizado.');
    } catch (e: any) {
      addToast('info', 'Atualizado localmente.');
      refreshData();
      setShowBaixa(false);
    } finally {
      setIsLoading(false);
    }
  };

  const openNewOrder = () => {
      setOrderForm({
          ...emptyOrderForm,
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      });
      setShowOrderForm(true);
  };

  const openEditOrder = (order: Order) => {
      setOrderForm({ ...order });
      setShowOrderForm(true);
  };

  const openPicking = (order: Order) => {
      setSelectedOrder(order);
      setShowOrderPicking(true);
  };

  const handleSaveOrder = async () => {
      if (!orderForm.orderNumber || !orderForm.customerName) {
          addToast('error', 'Preencha Número e Nome.');
          return;
      }
      if (orderForm.items.length === 0) {
          addToast('error', 'Adicione itens.');
          return;
      }

      setIsLoading(true);
      try {
          const isNew = !orders.find(o => o.id === orderForm.id);
          const allPicked = orderForm.items.every(i => i.qtyPicked >= i.qtyRequested);
          const hasShipping = orderForm.envioMalote || orderForm.entregaMatriz;
          const status = (allPicked && hasShipping) ? 'completed' : 'pending';
          await storage.saveOrder({ ...orderForm, status }, isNew);
          await refreshData();
          setShowOrderForm(false);
          addToast('success', 'Pedido salvo!');
      } catch (e: any) {
          addToast('info', 'Salvo localmente.');
          refreshData();
          setShowOrderForm(false);
      } finally {
          setIsLoading(false);
      }
  };

  const toggleShippingMethod = async (order: Order, method: 'malote' | 'matriz') => {
    setIsLoading(true);
    try {
        const updatedOrder = { ...order };
        if (method === 'malote') updatedOrder.envioMalote = !order.envioMalote;
        else updatedOrder.entregaMatriz = !order.entregaMatriz;

        const allPicked = updatedOrder.items.every(i => i.qtyPicked >= i.qtyRequested);
        const hasShipping = updatedOrder.envioMalote || updatedOrder.entregaMatriz;
        const newStatus = (allPicked && hasShipping) ? 'completed' : 'pending';
        updatedOrder.status = newStatus;

        await storage.saveOrder(updatedOrder, false);
        if (newStatus === 'completed' && order.status !== 'completed') {
            await storage.saveMovement({
                id: Date.now(),
                date: new Date().toISOString(),
                prodId: null, 
                prodName: `Envio Pedido #${updatedOrder.orderNumber}`,
                qty: 0,
                obs: `Concluído via ${updatedOrder.envioMalote ? 'Malote' : 'Matriz'}`,
                matricula: updatedOrder.matricula
            });
        }
        await refreshData();
        addToast('success', 'Status atualizado!');
    } catch (e: any) {
        addToast('info', 'Status alterado localmente.');
        refreshData();
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteOrder = async (id: string) => {
      if(!window.confirm('Excluir pedido definitivamente?')) return;
      setIsLoading(true);
      try {
          await storage.deleteOrder(id);
          await refreshData();
          addToast('success', 'Pedido excluído.');
      } catch (e: any) {
          addToast('info', 'Agendado para exclusão.');
          refreshData();
      } finally {
          setIsLoading(false);
      }
  };

  const addProductToOrder = (product: Product) => {
      const existing = orderForm.items.find(i => i.productId === product.id);
      if (existing) {
          const updatedItems = orderForm.items.map(i => 
              i.productId === product.id ? { ...i, qtyRequested: i.qtyRequested + 1 } : i
          );
          setOrderForm({ ...orderForm, items: updatedItems });
      } else {
          const newItem: OrderItem = {
              productId: product.id,
              productName: product.name,
              qtyRequested: 1,
              qtyPicked: 0
          };
          setOrderForm({ ...orderForm, items: [...orderForm.items, newItem] });
      }
      addToast('success', 'Item adicionado.');
  };

  const updateOrderItemQty = (prodId: string, newQty: number) => {
      if (newQty <= 0) {
          setOrderForm({ ...orderForm, items: orderForm.items.filter(i => i.productId !== prodId) });
      } else {
          setOrderForm({
              ...orderForm,
              items: orderForm.items.map(i => i.productId === prodId ? { ...i, qtyRequested: newQty } : i)
          });
      }
  };

  const handlePickItem = async (item: OrderItem, silent: boolean = false) => {
      if (!selectedOrder) return;
      if (item.qtyPicked >= item.qtyRequested) return;

      // FIX: Robust ID comparison
      // Garante que ambos sejam strings e sem espaços para comparar
      const productInStock = products.find(p => String(p.id).trim() === String(item.productId).trim());

      if (!productInStock) {
          addToast('error', `Produto não encontrado no estoque (ID: ${item.productId})`);
          return;
      }
      
      if (productInStock.qty <= 0) {
          addToast('error', `Sem estoque para ${item.productName}!`);
          return;
      }

      if(!silent && !window.confirm(`Confirmar separação de ${item.productName}?`)) return;

      setIsLoading(true);
      try {
          await storage.saveProduct({ ...productInStock, qty: productInStock.qty - 1 }, false);
          await storage.saveMovement({
              id: Date.now(),
              date: new Date().toISOString(),
              prodId: item.productId,
              prodName: item.productName,
              qty: -1,
              obs: `Separação Pedido #${selectedOrder.orderNumber}`,
              matricula: selectedOrder.matricula
          });
          const updatedItems = selectedOrder.items.map(i => 
              i.productId === item.productId ? { ...i, qtyPicked: i.qtyPicked + 1 } : i
          );
          const updatedOrder: Order = { ...selectedOrder, items: updatedItems, status: 'pending' };
          await storage.saveOrder(updatedOrder, false);
          setSelectedOrder(updatedOrder);
          await refreshData(); 
          addToast('success', `Item separado.`);
      } catch (e: any) {
          addToast('info', 'Agendado localmente.');
          refreshData();
      } finally {
          setIsLoading(false);
      }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const text = event.target?.result as string;
              if(!text) return;
              setIsLoading(true);
              const lines = text.split('\n');
              const newOrdersMap = new Map<string, Order>();
              const startIdx = lines[0].toLowerCase().includes('numero') ? 1 : 0;
              for(let i = startIdx; i < lines.length; i++) {
                  const line = lines[i].trim();
                  if(!line) continue;
                  const [num, client, fil, mat, dateStr, prodCode, qtyStr] = line.split(';');
                  if(!num || !prodCode) continue;
                  const qty = parseInt(qtyStr) || 1;
                  const prod = products.find(p => p.id === prodCode);
                  const prodName = prod ? prod.name : `Produto ${prodCode}`;
                  if(!newOrdersMap.has(num)) {
                      newOrdersMap.set(num, {
                          id: crypto.randomUUID ? crypto.randomUUID() : `IMP-${Date.now()}-${i}`,
                          orderNumber: num,
                          customerName: client || 'Importado',
                          filial: fil || '', 
                          matricula: mat || '',
                          date: dateStr || new Date().toISOString().slice(0,10),
                          status: 'pending',
                          items: [],
                          obs: 'Importado via CSV'
                      });
                  }
                  const order = newOrdersMap.get(num)!;
                  const existingItem = order.items.find(it => it.productId === prodCode);
                  if(existingItem) existingItem.qtyRequested += qty;
                  else order.items.push({ productId: prodCode, productName: prodName, qtyRequested: qty, qtyPicked: 0 });
              }
              for (const order of newOrdersMap.values()) await storage.saveOrder(order, true);
              await refreshData();
              addToast('success', `${newOrdersMap.size} pedidos importados!`);
              setShowImport(false);
          } catch (err: any) {
              addToast('error', 'Falha ao processar CSV.');
          } finally {
              setIsLoading(false);
              if(fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  const handleScan = (code: string) => {
    setShowScanner(false);
    if (scanMode === 'global') {
        const prod = products.find(p => p.id === code);
        if (prod) {
          setSelectedProduct(prod);
          setTransactionType('out'); 
          setBaixaForm({ qty: 1, obs: '', matricula: '' });
          setShowBaixa(true);
        } else if(window.confirm(`Código ${code} não encontrado. Cadastrar agora?`)) {
            setNewProdForm({ id: code, name: '', qty: '' });
            setShowAddProduct(true);
        }
    } else if (scanMode === 'order' && selectedOrder) {
        // Busca usando a mesma lógica robusta do handlePickItem
        const item = selectedOrder.items.find(i => String(i.productId).trim() === String(code).trim());
        if (item) handlePickItem(item, true);
        else addToast('error', 'Item não pertence a este pedido.');
        setScanMode('global');
    }
  };

  const openOrderScanner = () => { setScanMode('order'); setShowScanner(true); };
  const handleManualCodeCheck = () => {
    const code = (document.getElementById('manual-code-input') as HTMLInputElement)?.value;
    if(code) handleScan(code);
  };
  const openTransactionModal = (product: Product) => {
      setSelectedProduct(product);
      setTransactionType('out');
      setBaixaForm({ qty: 1, obs: '', matricula: '' });
      setShowBaixa(true);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || String(p.id).toLowerCase().includes(search.toLowerCase())
  );

  const filteredHistory = movements.filter(m => {
      if (!startDate && !endDate) return true;
      const mDate = new Date(m.date);
      mDate.setHours(0,0,0,0);
      let valid = true;
      if (startDate) {
          const sDate = new Date(startDate); sDate.setHours(0,0,0,0);
          valid = valid && mDate.getTime() >= sDate.getTime();
      }
      if (endDate) {
          const eDate = new Date(endDate); eDate.setHours(0,0,0,0);
          valid = valid && mDate.getTime() <= eDate.getTime();
      }
      return valid;
  });

  const filteredOrderProducts = products.filter(p => 
    p.name.toLowerCase().includes(orderItemSearch.toLowerCase()) || String(p.id).toLowerCase().includes(orderItemSearch.toLowerCase())
  );

  return (
    <div className="max-w-[480px] mx-auto bg-slate-50 min-h-screen relative shadow-2xl pb-24">
      <Toast toasts={toasts} removeToast={removeToast} />

      <header className="bg-qq-green text-white p-4 sticky top-0 z-40 shadow-lg flex justify-between items-center rounded-b-3xl">
        <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                <Box size={24} className="text-white" />
            </div>
            <div>
                <h1 className="text-lg font-bold leading-tight">Estoque <span className="text-qq-yellow">Palavra</span></h1>
                <div className="flex items-center gap-1.5 opacity-80">
                    {isOnline ? (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                        <span className="text-[10px] font-medium tracking-wide uppercase">Conectado</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                        <span className="text-[10px] font-medium tracking-wide uppercase">Offline</span>
                      </div>
                    )}
                </div>
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={refreshData} className="w-10 h-10 flex items-center justify-center bg-qq-green-dark/50 hover:bg-qq-green-dark rounded-full transition relative">
                <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                {pendingSyncs > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-qq-green">
                    {pendingSyncs}
                  </span>
                )}
            </button>
            <button onClick={() => setShowExport(true)} className="w-10 h-10 flex items-center justify-center bg-qq-green-dark/50 hover:bg-qq-green-dark rounded-full transition">
                <FileText size={18} />
            </button>
            <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center bg-qq-green-dark/50 hover:bg-qq-green-dark rounded-full transition">
                <Settings size={18} />
            </button>
        </div>
      </header>

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-qq-green rounded-full animate-spin"></div>
        </div>
      )}

      {view === 'home' && (
        <div className="p-6 animate-fade-in space-y-6">
            <div className="flex justify-between items-end">
                <h2 className="text-2xl font-bold text-slate-800">Produtos</h2>
                <button onClick={() => setShowAddProduct(true)} className="bg-qq-yellow hover:bg-qq-yellow-dark text-slate-900 px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-orange-100 transition flex items-center gap-2 active:scale-95">
                    <Plus size={18} /> Novo
                </button>
            </div>

            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder="Buscar nome ou código..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-slate-700 focus:outline-none focus:border-qq-green transition-all shadow-sm"
                />
            </div>

            <div className="space-y-3">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                        <Box size={48} className="mx-auto mb-3 text-slate-400" />
                        <p>Nenhum produto encontrado</p>
                    </div>
                ) : (
                    filteredProducts.map(p => (
                        <div key={p.id} onClick={() => openTransactionModal(p)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center active:scale-[0.98] transition-transform cursor-pointer">
                            <div className="flex-1 min-w-0 pr-4">
                                <h3 className="font-bold text-slate-800 truncate">{p.name}</h3>
                                <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs font-mono">
                                    {p.id}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <div className={`text-[10px] font-bold uppercase mb-0.5 px-1.5 py-0.5 rounded-md inline-block ${p.qty < 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                        {p.qty < 5 ? 'Baixo' : 'Ok'}
                                    </div>
                                    <div className="text-xl font-bold text-slate-700">{p.qty}</div>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setViewQRProduct(p); }} 
                                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-qq-green transition-colors"
                                >
                                    <QrCode size={20} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      )}

      {view === 'orders' && (
          <div className="p-6 animate-fade-in space-y-6">
              <div className="flex justify-between items-end">
                  <h2 className="text-2xl font-bold text-slate-800">Pedidos</h2>
                  <button onClick={openNewOrder} className="bg-qq-green hover:bg-qq-green-dark text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-green-100 transition flex items-center gap-2 active:scale-95">
                      <Plus size={18} /> Criar Pedido
                  </button>
              </div>

              <div className="space-y-4">
                  {orders.length === 0 ? (
                      <div className="text-center py-12 opacity-50 text-slate-400">
                          <ShoppingCart size={48} className="mx-auto mb-3" />
                          <p>Nenhum pedido registrado</p>
                      </div>
                  ) : (
                      orders.map(order => {
                          const totalItems = order.items.reduce((acc, i) => acc + i.qtyRequested, 0);
                          const pickedItems = order.items.reduce((acc, i) => acc + i.qtyPicked, 0);
                          const progress = totalItems > 0 ? (pickedItems / totalItems) * 100 : 0;
                          const isFullyPicked = totalItems > 0 && pickedItems === totalItems;
                          const isCompleted = order.status === 'completed';

                          return (
                              <div key={order.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 active:scale-[0.99] transition-transform relative overflow-hidden">
                                  <div className="flex justify-between items-start mb-2">
                                      <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-800">#{order.orderNumber}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {isCompleted ? 'Concluído' : (isFullyPicked ? 'Pronto' : 'Pendente')}
                                            </span>
                                          </div>
                                          <p className="text-sm font-medium text-slate-600 truncate max-w-[200px]">{order.customerName}</p>
                                          <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-2 gap-y-1">
                                            <span>{new Date(order.date).toLocaleDateString('pt-BR')}</span>
                                            {order.filial && <span className="bg-slate-50 px-1 border border-slate-100 rounded">Filial: {order.filial}</span>}
                                          </div>
                                          
                                          {isFullyPicked && (
                                              <div className="flex gap-2 mt-3 pt-2 border-t border-slate-50">
                                                <label className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1.5 rounded-lg border cursor-pointer ${order.envioMalote ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                                                    <input type="checkbox" checked={!!order.envioMalote} onChange={() => toggleShippingMethod(order, 'malote')} className="hidden" />
                                                    <Truck size={14} /> Malote
                                                </label>
                                                <label className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1.5 rounded-lg border cursor-pointer ${order.entregaMatriz ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                                                    <input type="checkbox" checked={!!order.entregaMatriz} onChange={() => toggleShippingMethod(order, 'matriz')} className="hidden" />
                                                    <Building size={14} /> Matriz
                                                </label>
                                              </div>
                                          )}
                                      </div>
                                      <div className="flex gap-1 flex-col">
                                          <button onClick={() => openEditOrder(order)} className="p-2 text-slate-400 hover:text-qq-green transition"><Edit size={18} /></button>
                                          <button onClick={() => handleDeleteOrder(order.id)} className="p-2 text-slate-400 hover:text-red-500 transition"><Trash2 size={18} /></button>
                                      </div>
                                  </div>
                                  
                                  <div onClick={() => openPicking(order)} className="mt-3 cursor-pointer group">
                                      <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                                          <span>Progresso</span>
                                          <span>{pickedItems}/{totalItems}</span>
                                      </div>
                                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                          <div className={`h-full transition-all duration-500 ${isFullyPicked ? 'bg-qq-green' : 'bg-qq-yellow'}`} style={{ width: `${progress}%` }}></div>
                                      </div>
                                  </div>
                              </div>
                          );
                      })
                  )}
              </div>
          </div>
      )}

      {view === 'scan' && (
        <div className="p-6 animate-fade-in flex flex-col h-[80vh]">
            <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">Leitor</h2>
            <div onClick={() => { setScanMode('global'); setShowScanner(true); }} className="flex-1 bg-slate-800 rounded-3xl flex flex-col items-center justify-center text-white/50 cursor-pointer hover:bg-slate-700 transition shadow-inner overflow-hidden relative">
                <QrCode size={64} className="mb-4 text-white" />
                <p className="font-medium text-white">Toque para escanear</p>
            </div>
            <div className="mt-8 flex gap-3">
                <input id="manual-code-input" type="text" placeholder="Digitar código..." className="flex-1 bg-white border-2 border-slate-200 rounded-xl px-4 py-3 font-mono font-bold outline-none" />
                <button onClick={handleManualCodeCheck} className="bg-qq-green text-white px-5 rounded-xl transition"><ArrowRight size={24} /></button>
            </div>
        </div>
      )}

      {view === 'history' && (
        <div className="p-6 animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-slate-800">Histórico</h2>
                <button onClick={handleClearHistory} className="text-white bg-red-500 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"><Trash2 size={14} /> Limpar</button>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1 uppercase">De:</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 border rounded-lg p-2 text-xs outline-none" />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1 uppercase">Até:</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-50 border rounded-lg p-2 text-xs outline-none" />
                </div>
            </div>

            <div className="space-y-3">
                {filteredHistory.length === 0 ? (
                    <div className="text-center py-12 opacity-50 text-slate-400">
                        <History size={48} className="mx-auto mb-3" />
                        <p>Nenhum registro encontrado</p>
                    </div>
                ) : (
                    filteredHistory.map(m => (
                        <div key={m.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start gap-3">
                            <div className={`mt-1 p-2 rounded-lg ${!m.prodId ? 'bg-blue-50 text-blue-700' : (m.qty > 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700')}`}>
                                {!m.prodId ? <Truck size={16} /> : (m.qty > 0 ? <Plus size={16} /> : <Minus size={16} />)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between">
                                    <h4 className="font-bold text-slate-800 truncate text-sm">{m.prodName}</h4>
                                    {m.qty !== 0 && <span className={`font-bold text-sm ${m.qty > 0 ? 'text-green-600' : 'text-qq-yellow'}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</span>}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 flex gap-2 font-medium">
                                    <span>{new Date(m.date).toLocaleString('pt-BR')}</span>
                                    {m.matricula && <span className="text-slate-600">Mat: {m.matricula}</span>}
                                </div>
                                {m.obs && <p className="mt-1 text-[11px] text-slate-500 italic">"{m.obs}"</p>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      )}

      <nav className="fixed bottom-0 w-full max-w-[480px] bg-white border-t border-slate-100 flex justify-around py-2 z-40 shadow-xl">
        <button onClick={() => setView('home')} className={`flex flex-col items-center p-2 ${view === 'home' ? 'text-qq-green' : 'text-slate-400'}`}>
            <Package size={24} />
            <span className="text-[10px] font-bold mt-1">Estoque</span>
        </button>
        <button onClick={() => setView('orders')} className={`flex flex-col items-center p-2 ${view === 'orders' ? 'text-qq-green' : 'text-slate-400'}`}>
            <ShoppingCart size={24} />
            <span className="text-[10px] font-bold mt-1">Pedidos</span>
        </button>
        <div className="relative -top-6">
            <button onClick={() => { setScanMode('global'); setView('scan'); }} className="w-16 h-16 rounded-full bg-gradient-to-br from-qq-yellow to-qq-yellow-dark text-white flex items-center justify-center shadow-lg border-4 border-slate-50 transition active:scale-90">
                <QrCode size={28} />
            </button>
        </div>
        <button onClick={() => setView('history')} className={`flex flex-col items-center p-2 ${view === 'history' ? 'text-qq-green' : 'text-slate-400'}`}>
            <ClipboardList size={24} />
            <span className="text-[10px] font-bold mt-1">Histórico</span>
        </button>
        <button onClick={() => setShowImport(true)} className="flex flex-col items-center p-2 text-slate-400">
            <Upload size={24} />
            <span className="text-[10px] font-bold mt-1">Importar</span>
        </button>
      </nav>

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <Database size={24} className="text-qq-green" />
                    <h3 className="text-xl font-bold text-slate-800">Sincronização</h3>
                </div>
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${isOnline ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                    <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                    <p className="font-bold text-slate-800">{isOnline ? 'Sincronizado com a Nuvem' : 'Trabalhando em Modo Offline'}</p>
                </div>
                <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                    Sincronização em tempo real ativada. Se você realizar alterações offline, elas serão enviadas assim que a conexão for restaurada.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                    <button onClick={handleTestConnection} className="bg-blue-50 text-blue-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-blue-100 hover:bg-blue-100 transition">
                        <Activity size={18} /> Testar Conexão
                    </button>
                    <button onClick={() => { refreshData(); setShowSettings(false); }} className="bg-qq-green text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                        <RefreshCw size={18} /> Forçar Sincronismo
                    </button>
                    <button onClick={() => setShowSettings(false)} className="bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">Fechar</button>
                </div>
            </div>
        </div>
      )}
      
      {/* ... Rest of modals ... */}
      
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <h3 className="text-xl font-bold mb-6 text-center">Novo Produto</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="Código (EAN/QR)" value={newProdForm.id} onChange={e => setNewProdForm({...newProdForm, id: e.target.value})} className="w-full border-2 rounded-xl p-3 outline-none" />
                    <input type="text" placeholder="Nome do Produto" value={newProdForm.name} onChange={e => setNewProdForm({...newProdForm, name: e.target.value})} className="w-full border-2 rounded-xl p-3 outline-none" />
                    <input type="number" placeholder="Quantidade Inicial" value={newProdForm.qty} onChange={e => setNewProdForm({...newProdForm, qty: e.target.value})} className="w-full border-2 rounded-xl p-3 outline-none" />
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowAddProduct(false)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold">Cancelar</button>
                    <button onClick={handleSaveProduct} className="flex-1 bg-qq-green text-white py-3 rounded-xl font-bold">Salvar</button>
                </div>
            </div>
        </div>
      )}

      {showOrderForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{orderForm.orderNumber ? 'Editar' : 'Novo'} Pedido</h3>
                    <button onClick={() => setShowOrderForm(false)} className="text-slate-400"><X size={24}/></button>
                  </div>
                  <div className="overflow-y-auto flex-1 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold ml-1 uppercase">Nº Pedido</label>
                            <input type="text" value={orderForm.orderNumber} onChange={e => setOrderForm({...orderForm, orderNumber: e.target.value})} className="w-full border-2 rounded-xl p-2 text-sm font-bold" placeholder="000" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold ml-1 uppercase">Data do Pedido</label>
                            <input type="date" value={orderForm.date ? orderForm.date.split('T')[0] : ''} onChange={e => setOrderForm({...orderForm, date: e.target.value})} className="w-full border-2 rounded-xl p-2 text-sm" />
                          </div>
                      </div>
                      
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold ml-1 uppercase">Nome do Cliente</label>
                        <input type="text" value={orderForm.customerName} onChange={e => setOrderForm({...orderForm, customerName: e.target.value})} className="w-full border-2 rounded-xl p-2 text-sm" placeholder="Nome Completo" />
                      </div>
                      
                      {/* Novos Campos */}
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold ml-1 uppercase">Whatsapp / Telefone</label>
                        <input type="text" value={orderForm.whatsapp || ''} onChange={e => setOrderForm({...orderForm, whatsapp: e.target.value})} className="w-full border-2 rounded-xl p-2 text-sm" placeholder="(00) 00000-0000" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold ml-1 uppercase">Forma de Pagamento</label>
                        <div className="flex gap-2">
                            <input type="text" value={orderForm.paymentMethod || ''} onChange={e => setOrderForm({...orderForm, paymentMethod: e.target.value})} className="flex-1 border-2 rounded-xl p-2 text-sm" placeholder="Ex: Cartão de Crédito" />
                            <div className="w-24">
                                <input type="text" value={orderForm.cardLast4 || ''} onChange={e => setOrderForm({...orderForm, cardLast4: e.target.value.slice(0,4)})} maxLength={4} className="w-full border-2 rounded-xl p-2 text-sm text-center" placeholder="4 Díg" />
                            </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] text-slate-500 font-bold ml-1 uppercase">Filial</label>
                            <input type="text" value={orderForm.filial} onChange={e => setOrderForm({...orderForm, filial: e.target.value})} className="w-full border-2 rounded-xl p-2 text-sm" placeholder="000" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 font-bold ml-1 uppercase">Matrícula</label>
                            <input type="text" value={orderForm.matricula} onChange={e => setOrderForm({...orderForm, matricula: e.target.value})} className="w-full border-2 rounded-xl p-2 text-sm" placeholder="000000" />
                        </div>
                      </div>
                      <hr />
                      <div className="relative">
                         <input type="text" placeholder="Adicionar produto..." value={orderItemSearch} onChange={e => setOrderItemSearch(e.target.value)} className="w-full p-2.5 bg-slate-50 rounded-xl text-sm border outline-none" />
                         {orderItemSearch && (
                             <div className="absolute top-full left-0 right-0 bg-white shadow-xl border rounded-xl mt-1 z-10 max-h-40 overflow-y-auto">
                                 {filteredOrderProducts.map(p => (
                                     <div key={p.id} onClick={() => { addProductToOrder(p); setOrderItemSearch(''); }} className="p-2 hover:bg-slate-50 cursor-pointer flex justify-between text-xs font-bold border-b border-slate-50">
                                         <span>{p.name}</span>
                                         <span>Qtd: {p.qty}</span>
                                     </div>
                                 ))}
                             </div>
                         )}
                      </div>
                      <div className="space-y-2">
                          {orderForm.items.map(item => (
                              <div key={item.productId} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl text-xs font-bold">
                                  <span className="truncate flex-1 pr-2">{item.productName}</span>
                                  <div className="flex items-center gap-2">
                                      <button onClick={() => updateOrderItemQty(item.productId, item.qtyRequested - 1)} className="w-6 h-6 border rounded"><Minus size={10} className="mx-auto" /></button>
                                      <span>{item.qtyRequested}</span>
                                      <button onClick={() => updateOrderItemQty(item.productId, item.qtyRequested + 1)} className="w-6 h-6 border rounded"><Plus size={10} className="mx-auto" /></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
                  <button onClick={handleSaveOrder} className="w-full bg-qq-green text-white py-3 rounded-xl font-bold mt-4 flex items-center justify-center gap-2">
                      <Save size={18} /> Salvar Pedido
                  </button>
              </div>
          </div>
      )}

      {showOrderPicking && selectedOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="flex justify-between mb-4">
                    <div>
                        <h3 className="text-xl font-bold">Separação #{selectedOrder.orderNumber}</h3>
                        <p className="text-xs text-slate-500 truncate">{selectedOrder.customerName}</p>
                    </div>
                    <button onClick={() => setShowOrderPicking(false)} className="text-slate-400"><X size={20}/></button>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-4 flex justify-between items-center text-xs text-blue-800">
                      <p className="font-bold">Modo Coleta</p>
                      <button onClick={openOrderScanner} className="bg-blue-600 text-white p-2 rounded-lg flex items-center gap-1">
                          <ScanLine size={18} /> Escanear
                      </button>
                  </div>
                  <div className="overflow-y-auto flex-1 space-y-2">
                      {selectedOrder.items.map(item => {
                          const isFullyPicked = item.qtyPicked >= item.qtyRequested;
                          return (
                              <div key={item.productId} onClick={() => !isFullyPicked && handlePickItem(item)} className={`p-3 rounded-xl border transition-all ${isFullyPicked ? 'bg-green-50 border-green-200 opacity-60' : 'bg-white border-slate-200 shadow-sm cursor-pointer'}`}>
                                  <div className="flex justify-between text-sm font-bold mb-1">
                                      <span>{item.productName}</span>
                                      {isFullyPicked && <CheckSquare size={16} className="text-green-600" />}
                                  </div>
                                  <div className="flex justify-between items-end">
                                    <p className="text-xs text-slate-500">Separado: {item.qtyPicked} / {item.qtyRequested}</p>
                                    {!isFullyPicked && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">Toque para baixar 1</span>}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}

      {showBaixa && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                    <button onClick={() => setTransactionType('out')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${transactionType === 'out' ? 'bg-white text-qq-yellow shadow-sm' : 'text-slate-400'}`}>Saída</button>
                    <button onClick={() => setTransactionType('in')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${transactionType === 'in' ? 'bg-white text-qq-green shadow-sm' : 'text-slate-400'}`}>Entrada</button>
                </div>
                <div className="text-center mb-6">
                    <h3 className="text-xl font-bold leading-tight truncate">{selectedProduct.name}</h3>
                    <p className="text-slate-500 text-sm mt-1">Estoque atual: <span className="font-bold text-slate-800">{selectedProduct.qty}</span></p>
                </div>
                <div className="flex items-center justify-center gap-4 mb-6">
                    <button onClick={() => setBaixaForm({...baixaForm, qty: Math.max(1, baixaForm.qty - 1)})} className="w-10 h-10 rounded-full bg-slate-100 font-bold flex items-center justify-center"><Minus size={18}/></button>
                    <input type="number" value={baixaForm.qty} onChange={e => setBaixaForm({...baixaForm, qty: parseInt(e.target.value) || 1})} className="w-20 text-center text-2xl font-bold outline-none bg-transparent" />
                    <button onClick={() => setBaixaForm({...baixaForm, qty: baixaForm.qty + 1})} className="w-10 h-10 rounded-full bg-slate-100 font-bold flex items-center justify-center"><Plus size={18}/></button>
                </div>
                <div className="space-y-3">
                    <input type="text" placeholder="Sua Matrícula" value={baixaForm.matricula} onChange={e => setBaixaForm({...baixaForm, matricula: e.target.value})} className="w-full border-2 rounded-xl p-3 text-sm outline-none" />
                    <textarea placeholder="Observação (opcional)" value={baixaForm.obs} onChange={e => setBaixaForm({...baixaForm, obs: e.target.value})} rows={2} className="w-full bg-slate-50 border-2 rounded-xl p-3 text-sm outline-none resize-none"></textarea>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => { setShowBaixa(false); setSelectedProduct(null); }} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold">Sair</button>
                    <button onClick={handleConfirmTransaction} className={`flex-1 text-white py-3 rounded-xl font-bold shadow-lg ${transactionType === 'in' ? 'bg-qq-green' : 'bg-qq-yellow text-slate-900'}`}>{transactionType === 'in' ? 'Confirmar Entrada' : 'Confirmar Saída'}</button>
                </div>
            </div>
        </div>
      )}

      {showExport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <h3 className="text-xl font-bold mb-6 text-center">Exportar Dados</h3>
                <div className="space-y-3">
                    <button onClick={() => exporter.exportStockCSV(products)} className="w-full flex items-center p-4 rounded-xl border-2 text-qq-green font-bold bg-green-50/50 transition active:scale-95">Relatório de Estoque (.csv)</button>
                    <button onClick={() => exporter.exportMovementsCSV(movements)} className="w-full flex items-center p-4 rounded-xl border-2 text-yellow-700 font-bold bg-yellow-50/50 transition active:scale-95">Histórico de Movimentos (.csv)</button>
                    <button onClick={() => exporter.exportOrdersCSV(orders)} className="w-full flex items-center p-4 rounded-xl border-2 text-blue-700 font-bold bg-blue-50/50 transition active:scale-95">Lista de Pedidos (.csv)</button>
                </div>
                <button onClick={() => setShowExport(false)} className="w-full mt-6 bg-slate-100 py-3 rounded-xl font-bold">Fechar</button>
            </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <h3 className="text-xl font-bold mb-4 text-center">Importar Pedidos</h3>
                <div className="bg-slate-50 p-4 rounded-xl text-[10px] text-slate-500 mb-6">
                    <p className="font-bold mb-1">Formato do Arquivo CSV:</p>
                    <code className="block bg-white p-2 border rounded overflow-x-auto">Numero;Cliente;Filial;Matricula;Data;CodProduto;Qtd</code>
                </div>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} className="hidden" id="csv-upload" />
                <label htmlFor="csv-upload" className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer hover:bg-green-50 transition">
                    <Upload size={32} className="text-slate-400 mb-2" />
                    <span className="text-sm font-bold text-slate-600">Escolher arquivo CSV</span>
                </label>
                <button onClick={() => setShowImport(false)} className="w-full mt-6 bg-slate-100 py-3 rounded-xl font-bold">Cancelar</button>
            </div>
        </div>
      )}

      {showScanner && <Scanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      {viewQRProduct && <QRModal product={viewQRProduct} onClose={() => setViewQRProduct(null)} />}
    </div>
  );
};

export default App;