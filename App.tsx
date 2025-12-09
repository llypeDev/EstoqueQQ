import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, QrCode, ClipboardList, Plus, Search, Settings, 
  Database, Wifi, WifiOff, AlertTriangle, FileText, ArrowRight, Minus, 
  Trash2, Box, History
} from 'lucide-react';
import { Product, Movement, ViewState, ToastMessage } from './types';
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
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals State
  const [showSettings, setShowSettings] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showBaixa, setShowBaixa] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewQRProduct, setViewQRProduct] = useState<Product | null>(null);

  // Form States
  const [configForm, setConfigForm] = useState(storage.getSupabaseConfig());
  const [newProdForm, setNewProdForm] = useState({ id: '', name: '', qty: '' });
  const [baixaForm, setBaixaForm] = useState({ qty: 1, obs: '' });

  // --- HELPERS ---
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
      setProducts(prods);
      setMovements(movs);
    } catch (e) {
      console.error(e);
      addToast('error', 'Erro ao carregar dados.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- EFFECTS ---
  useEffect(() => {
    const online = storage.initSupabase();
    setIsOnline(online);
    refreshData();
  }, [refreshData]);

  // --- HANDLERS ---
  
  const handleSaveSettings = () => {
    storage.saveSupabaseConfig(configForm);
    const online = storage.initSupabase();
    setIsOnline(online);
    setShowSettings(false);
    addToast('success', online ? 'Conectado ao Supabase!' : 'Configuração salva (Offline).');
    refreshData();
  };

  const handleDisconnect = () => {
    storage.clearSupabaseConfig();
    setIsOnline(false);
    setConfigForm({ url: '', key: '' });
    setShowSettings(false);
    addToast('info', 'Desconectado. Usando modo offline.');
    refreshData();
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
      addToast('success', 'Produto salvo!');
    } catch (e: any) {
      addToast('error', e.message || 'Erro ao salvar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmBaixa = async () => {
    if (!selectedProduct) return;
    const qtyChange = baixaForm.qty; // Assuming this represents REMOVAL if positive in UI context, but let's clarify logic
    
    // In this app logic: "Baixa" means removing or updating stock. 
    // Usually stock apps have add/remove. The original only had "adjust".
    // Let's implement it as: Negative input adds stock? Or dedicated "Add/Remove"?
    // The original UI implies stock adjustment. Let's assume the user enters how many to REMOVE.
    
    if (selectedProduct.qty < qtyChange) {
      addToast('error', 'Estoque insuficiente.');
      return;
    }

    setIsLoading(true);
    try {
      const newQty = selectedProduct.qty - qtyChange;
      const updatedProd = { ...selectedProduct, qty: newQty };
      
      await storage.saveProduct(updatedProd, false);
      await storage.saveMovement({
        id: Date.now(), // Ignored by Supabase, used for local
        date: new Date().toISOString(),
        prodId: selectedProduct.id,
        prodName: selectedProduct.name,
        qty: qtyChange, // Quantity removed
        obs: baixaForm.obs
      });

      await refreshData();
      setShowBaixa(false);
      setSelectedProduct(null);
      setBaixaForm({ qty: 1, obs: '' });
      addToast('success', 'Estoque atualizado!');
    } catch (e: any) {
      addToast('error', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScan = (code: string) => {
    setShowScanner(false);
    const prod = products.find(p => p.id === code);
    if (prod) {
      setSelectedProduct(prod);
      setShowBaixa(true);
    } else {
        // If product doesn't exist, prompt to add it
        if(window.confirm(`Produto ${code} não encontrado. Deseja cadastrar?`)) {
            setNewProdForm({ id: code, name: '', qty: '' });
            setShowAddProduct(true);
        }
    }
  };

  const handleManualCodeCheck = () => {
    // Re-using the manual input form from scanner page
    const code = (document.getElementById('manual-code-input') as HTMLInputElement)?.value;
    if(code) handleScan(code);
  };

  // --- RENDER HELPERS ---
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-[480px] mx-auto bg-slate-50 min-h-screen relative shadow-2xl pb-20">
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* --- HEADER --- */}
      <header className="bg-qq-green text-white p-4 sticky top-0 z-40 shadow-lg flex justify-between items-center rounded-b-3xl">
        <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                <Box size={24} className="text-white" />
            </div>
            <div>
                <h1 className="text-lg font-bold leading-tight">Estoque <span className="text-qq-yellow">QQ</span></h1>
                <div className="flex items-center gap-1.5 opacity-80">
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-slate-400'}`}></div>
                    <span className="text-[10px] font-medium tracking-wide uppercase">{isOnline ? 'Online' : 'Offline'}</span>
                </div>
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowExport(true)} className="w-10 h-10 flex items-center justify-center bg-qq-green-dark/50 hover:bg-qq-green-dark rounded-full transition active:scale-95 backdrop-blur-sm">
                <FileText size={18} />
            </button>
            <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center bg-qq-green-dark/50 hover:bg-qq-green-dark rounded-full transition active:scale-95 backdrop-blur-sm">
                <Settings size={18} />
            </button>
        </div>
      </header>

      {/* --- LOADING --- */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-qq-green rounded-full animate-spin"></div>
        </div>
      )}

      {/* --- VIEW: HOME --- */}
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
                    <Search className="h-5 w-5 text-slate-400 group-focus-within:text-qq-green transition-colors" />
                </div>
                <input
                    type="text"
                    placeholder="Buscar nome ou código..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-slate-700 focus:outline-none focus:border-qq-green focus:ring-4 focus:ring-qq-green/10 transition-all shadow-sm"
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
                        <div key={p.id} onClick={() => { setSelectedProduct(p); setShowBaixa(true); }} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center active:scale-[0.98] transition-transform cursor-pointer">
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

      {/* --- VIEW: SCAN --- */}
      {view === 'scan' && (
        <div className="p-6 animate-fade-in flex flex-col h-[80vh]">
            <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">Ler Código</h2>
            
            <div 
                onClick={() => setShowScanner(true)}
                className="flex-1 bg-slate-800 rounded-3xl flex flex-col items-center justify-center text-white/50 cursor-pointer hover:bg-slate-700 transition-colors shadow-inner relative overflow-hidden group"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 to-transparent opacity-50"></div>
                <QrCode size={64} className="mb-4 group-hover:scale-110 transition-transform duration-300 text-white" />
                <p className="font-medium text-white">Toque para abrir a câmera</p>
            </div>

            <div className="mt-8">
                <div className="flex gap-3">
                    <input 
                        id="manual-code-input"
                        type="text" 
                        placeholder="Digitar código..." 
                        className="flex-1 bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold text-slate-700 focus:border-qq-green outline-none"
                    />
                    <button onClick={handleManualCodeCheck} className="bg-qq-green text-white px-5 rounded-xl shadow-lg active:scale-95 transition-transform">
                        <ArrowRight size={24} />
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- VIEW: HISTORY --- */}
      {view === 'history' && (
        <div className="p-6 animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Histórico</h2>
                <button onClick={() => { if(confirm('Limpar histórico local?')) { storage.clearLocalHistory(); refreshData(); } }} className="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition">
                    <Trash2 size={14} /> Limpar
                </button>
            </div>

            <div className="space-y-4">
                {movements.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                        <History size={48} className="mx-auto mb-3 text-slate-400" />
                        <p>Sem movimentações recentes</p>
                    </div>
                ) : (
                    movements.map(m => (
                        <div key={m.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start gap-4">
                            <div className="mt-1 bg-yellow-50 text-yellow-700 p-2 rounded-lg">
                                <Minus size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-slate-800 truncate">{m.prodName}</h4>
                                    <span className="font-bold text-qq-yellow">-{m.qty}</span>
                                </div>
                                <div className="text-xs text-slate-400 mt-1 flex justify-between">
                                    <span>{new Date(m.date).toLocaleString('pt-BR')}</span>
                                    <span className="font-mono">#{m.prodId}</span>
                                </div>
                                {m.obs && (
                                    <div className="mt-2 text-xs bg-slate-50 text-slate-600 p-2 rounded italic border border-slate-100">
                                        "{m.obs}"
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      )}

      {/* --- BOTTOM NAV --- */}
      <nav className="fixed bottom-0 w-full max-w-[480px] bg-white border-t border-slate-100 flex justify-around py-2 pb-safe z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <button onClick={() => setView('home')} className={`flex flex-col items-center p-2 transition-colors ${view === 'home' ? 'text-qq-green' : 'text-slate-400 hover:text-slate-600'}`}>
            <Package size={24} className={view === 'home' ? 'fill-current opacity-20' : ''} />
            <span className="text-[10px] font-bold mt-1">Estoque</span>
        </button>
        
        <div className="relative -top-6">
            <button onClick={() => setView('scan')} className="w-16 h-16 rounded-full bg-gradient-to-br from-qq-yellow to-qq-yellow-dark text-white flex items-center justify-center shadow-lg shadow-orange-200 border-4 border-slate-50 transform transition active:scale-90">
                <QrCode size={28} />
            </button>
        </div>

        <button onClick={() => setView('history')} className={`flex flex-col items-center p-2 transition-colors ${view === 'history' ? 'text-qq-green' : 'text-slate-400 hover:text-slate-600'}`}>
            <ClipboardList size={24} className={view === 'history' ? 'fill-current opacity-20' : ''} />
            <span className="text-[10px] font-bold mt-1">Histórico</span>
        </button>
      </nav>

      {/* --- MODALS --- */}
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-qq-green/10 p-2 rounded-lg text-qq-green">
                        <Database size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Conexão</h3>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">URL do Projeto</label>
                        <input type="text" value={configForm.url} onChange={e => setConfigForm({...configForm, url: e.target.value})} className="w-full mt-1 border-2 border-slate-200 rounded-xl p-2.5 text-sm focus:border-qq-green outline-none font-mono" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Chave de API (Anon)</label>
                        <input type="password" value={configForm.key} onChange={e => setConfigForm({...configForm, key: e.target.value})} className="w-full mt-1 border-2 border-slate-200 rounded-xl p-2.5 text-sm focus:border-qq-green outline-none font-mono" />
                    </div>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                    <button onClick={handleSaveSettings} className="bg-qq-green text-white py-3 rounded-xl font-bold hover:bg-qq-green-dark transition">Salvar & Conectar</button>
                    {isOnline && (
                        <button onClick={handleDisconnect} className="bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-50 transition">Desconectar</button>
                    )}
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 text-sm font-medium py-2">Cancelar</button>
                </div>
            </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">Novo Produto</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="Código (Barras/QR)" value={newProdForm.id} onChange={e => setNewProdForm({...newProdForm, id: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl p-3 focus:border-qq-green outline-none" />
                    <input type="text" placeholder="Nome do Produto" value={newProdForm.name} onChange={e => setNewProdForm({...newProdForm, name: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl p-3 focus:border-qq-green outline-none" />
                    <input type="number" placeholder="Quantidade Inicial" value={newProdForm.qty} onChange={e => setNewProdForm({...newProdForm, qty: e.target.value})} className="w-full border-2 border-slate-200 rounded-xl p-3 focus:border-qq-green outline-none" />
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setShowAddProduct(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">Cancelar</button>
                    <button onClick={handleSaveProduct} className="flex-1 bg-qq-green text-white py-3 rounded-xl font-bold">Salvar</button>
                </div>
            </div>
        </div>
      )}

      {/* Baixa Modal */}
      {showBaixa && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-800 leading-tight">{selectedProduct.name}</h3>
                    <p className="text-slate-500 font-medium mt-1">Em estoque: <span className="text-qq-green font-bold">{selectedProduct.qty}</span></p>
                </div>

                <div className="flex items-center justify-center gap-4 mb-6">
                    <button onClick={() => setBaixaForm({...baixaForm, qty: Math.max(1, baixaForm.qty - 1)})} className="w-12 h-12 rounded-full bg-slate-100 text-slate-800 font-bold text-xl hover:bg-slate-200 transition"><Minus size={20} className="mx-auto" /></button>
                    <div className="w-24 h-16 border-2 border-slate-200 rounded-2xl flex items-center justify-center">
                        <input 
                            type="number" 
                            value={baixaForm.qty} 
                            onChange={e => setBaixaForm({...baixaForm, qty: parseInt(e.target.value) || 1})} 
                            className="w-full text-center text-2xl font-bold text-qq-yellow outline-none bg-transparent"
                        />
                    </div>
                    <button onClick={() => setBaixaForm({...baixaForm, qty: baixaForm.qty + 1})} className="w-12 h-12 rounded-full bg-slate-100 text-slate-800 font-bold text-xl hover:bg-slate-200 transition"><Plus size={20} className="mx-auto" /></button>
                </div>

                <textarea 
                    placeholder="Observação (Opcional)" 
                    value={baixaForm.obs}
                    onChange={e => setBaixaForm({...baixaForm, obs: e.target.value})}
                    rows={2}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-qq-yellow outline-none resize-none"
                ></textarea>

                <div className="flex gap-3 mt-6">
                    <button onClick={() => { setShowBaixa(false); setSelectedProduct(null); }} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">Cancelar</button>
                    <button onClick={handleConfirmBaixa} className="flex-1 bg-qq-yellow text-slate-900 py-3 rounded-xl font-bold hover:bg-qq-yellow-dark transition">Confirmar Baixa</button>
                </div>
            </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">Exportar Dados</h3>
                <div className="space-y-3">
                    <button onClick={() => exporter.exportStockCSV(products)} className="w-full flex items-center p-4 rounded-xl border-2 border-qq-green/20 bg-green-50/50 text-qq-green font-bold hover:bg-green-50 transition">
                        <Package size={24} className="mr-3" />
                        Estoque Atual (.csv)
                    </button>
                    <button onClick={() => exporter.exportMovementsCSV(movements)} className="w-full flex items-center p-4 rounded-xl border-2 border-qq-yellow/20 bg-yellow-50/50 text-yellow-700 font-bold hover:bg-yellow-50 transition">
                        <History size={24} className="mr-3" />
                        Histórico (.csv)
                    </button>
                </div>
                <button onClick={() => setShowExport(false)} className="w-full mt-6 bg-slate-100 py-3 rounded-xl font-bold text-slate-600">Fechar</button>
            </div>
        </div>
      )}

      {/* Scanner Overlay */}
      {showScanner && (
        <Scanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {/* QR Code View Modal */}
      {viewQRProduct && (
        <QRModal product={viewQRProduct} onClose={() => setViewQRProduct(null)} />
      )}

    </div>
  );
};

export default App;