import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Settings as SettingsIcon, Wallet, ArrowUpRight, ArrowDownLeft, Trash2, Moon, Sun, Bell, Image as ImageIcon, X, PieChart, CheckCircle2, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { cn, formatCurrency } from './lib/utils';
import { Goal, Transaction, ThemeType, ModeType, AppSettings } from './types';

// Components
const ThemeWrapper = ({ theme, mode, children }: { theme: ThemeType, mode: ModeType, children: React.ReactNode }) => {
  return (
    <div className={cn(
      `theme-${theme}`,
      mode === 'dark' ? 'dark bg-black text-white' : 'bg-zinc-50 text-black',
      'min-h-screen transition-colors duration-500 relative'
    )}>
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default function App() {
  // State
  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem('celengan_goals');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('celengan_settings');
    return saved ? JSON.parse(saved) : {
      theme: 'brutalist',
      mode: 'light',
      notificationsEnabled: false,
      reminderActive: false
    };
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('celengan_goals', JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem('celengan_settings', JSON.stringify(settings));
    if (settings.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Reminder logic: if active and permissions granted, show a test notification
    if (settings.reminderActive && settings.notificationsEnabled) {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // Just a demo: send a message to show a delayed notification
        navigator.serviceWorker.controller.postMessage({
          type: 'SCHEDULE_NOTIFICATION',
          delay: 5000,
          title: 'Celengan Digital',
          body: 'Jangan lupa menabung hari ini untuk impianmu!'
        });
      }
    }
  }, [settings]);

  // Notifications Request
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setSettings(s => ({ ...s, notificationsEnabled: true }));
      }
    }
  };

  // Logic: Goals
  const addGoal = (newGoal: Omit<Goal, 'id' | 'currentAmount' | 'transactions' | 'createdAt'>) => {
    const goal: Goal = {
      ...newGoal,
      id: crypto.randomUUID(),
      currentAmount: 0,
      transactions: [],
      createdAt: new Date().toISOString(),
    };
    setGoals([goal, ...goals]);
    setIsAddModalOpen(false);
  };

  const deleteGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    if (selectedGoal?.id === id) setSelectedGoal(null);
    setGoalToDelete(null);
  };

  const addTransaction = (goalId: string, amount: number, type: 'deposit' | 'withdrawal', note: string) => {
    if (amount <= 0) return;

    setGoals(prev => {
      const goal = prev.find(g => g.id === goalId);
      if (!goal) return prev;

      const transaction: Transaction = {
        id: crypto.randomUUID(),
        amount,
        type,
        note,
        date: new Date().toISOString()
      };

      const newAmount = type === 'deposit' ? goal.currentAmount + amount : goal.currentAmount - amount;

      if (newAmount < 0) {
        alert('Saldo tabungan tidak cukup!');
        return prev;
      }

      return prev.map(g => {
        if (g.id === goalId) {
          const updated = {
            ...g,
            currentAmount: newAmount,
            transactions: [transaction, ...g.transactions]
          };
          
          // Celebrate if target hit just now
          if (updated.currentAmount >= updated.targetAmount && g.currentAmount < g.targetAmount) {
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 }
            });
          }
          
          return updated;
        }
        return g;
      });
    });
    
    setIsTransactionModalOpen(false);
  };

  // UI Helpers
  const getCardClass = () => {
    switch(settings.theme) {
      case 'brutalist': return 'brutal-card';
      case 'glass': return 'glass-card p-6';
      case 'standard': return 'std-card p-6';
      case 'retro': return 'retro-card';
      case 'bento': return 'bento-card p-6';
    }
  };

  const getBtnClass = (variant: 'primary' | 'secondary' = 'primary') => {
    const base = settings.theme === 'brutalist' ? (variant === 'primary' ? 'brutal-btn brutal-btn-primary' : 'brutal-btn') : 
                 settings.theme === 'glass' ? 'glass-btn' : 
                 settings.theme === 'retro' ? 'retro-btn' :
                 settings.theme === 'bento' ? 'bento-btn' : 'std-btn';
    return base;
  };

  // Calculate total savings
  const totalSavings = useMemo(() => goals.reduce((acc, g) => acc + g.currentAmount, 0), [goals]);

  return (
    <ThemeWrapper theme={settings.theme} mode={settings.mode}>
      <div className={cn(
        "max-w-4xl mx-auto px-4 py-8 pb-32 min-h-screen",
        settings.theme === 'brutalist' ? "border-x-[12px] border-[#141414]" : ""
      )}>
        {/* Header */}
        <header className={cn(
          "flex justify-between items-center mb-12 p-6 transition-all",
          settings.theme === 'brutalist' ? "bg-[#00FF00] border-4 border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]" : "bg-transparent"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-3 rounded-xl",
              settings.theme === 'brutalist' ? "bg-white border-2 border-[#141414]" : "bg-zinc-900 text-white"
            )}>
              <Wallet size={32} />
            </div>
            <div>
              <h1 className={cn(
                "text-3xl font-display font-black tracking-tighter uppercase italic",
                settings.theme === 'brutalist' ? "text-[#141414]" : ""
              )}>Celengan Digital</h1>
              <p className="text-[10px] uppercase font-bold opacity-70">Atur masa depanmu, mulai hari ini.</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold opacity-70">Total Terkumpul</span>
              <span className="text-2xl font-black tabular-nums">{formatCurrency(totalSavings)}</span>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className={cn(
                "p-3 rounded-none transition-all hover:scale-110",
                settings.theme === 'brutalist' ? "bg-white border-2 border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]" : 
                settings.theme === 'glass' ? "bg-white/10" : "bg-black/5 dark:bg-white/5"
              )}
            >
              <SettingsIcon size={24} />
            </button>
          </div>
        </header>

        {/* Header Summary */}
        <div className="mb-12 space-y-6">
          <div className={cn(
            "p-8 relative overflow-hidden",
            settings.theme === 'brutalist' ? "brutal-card !bg-yellow-100" : 
            settings.theme === 'glass' ? "glass-card !bg-white/5" : "std-card !bg-zinc-900 !text-white"
          )}>
            <div className="relative z-10">
              <h2 className="text-xs uppercase font-black tracking-widest opacity-60 mb-2">Total Saldo Celengan</h2>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-5xl font-display font-black tracking-tighter">{formatCurrency(totalSavings)}</span>
                <span className="text-xs font-bold opacity-50 uppercase">Rupiah</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 border-t border-current/10 pt-6">
                <div>
                  <p className="text-[10px] uppercase font-bold opacity-50 mb-1">Target Aktif</p>
                  <p className="text-xl font-black">{goals.length}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold opacity-50 mb-1">Pencapaian</p>
                  <p className="text-xl font-black tabular-nums">
                    {goals.filter(g => g.currentAmount >= g.targetAmount).length}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Decoration */}
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Wallet size={120} className="rotate-12" />
            </div>
          </div>
        </div>

        {/* Goals Grid Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs uppercase font-black tracking-widest">Daftar Celengan</h3>
          <p className="text-[10px] opacity-50 font-mono">DIPERBARUI: {format(new Date(), 'HH:mm')}</p>
        </div>

        {/* Goals List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {goals.length === 0 ? (
            <div className={cn("text-center py-20 md:col-span-2", getCardClass())}>
              <div className="bg-blue-100 dark:bg-blue-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Wallet className="text-blue-600 dark:text-blue-400" size={40} />
              </div>
              <p className="font-display font-black text-2xl mb-2">Simpanan Masih Kosong</p>
              <p className="opacity-60 mb-8 max-w-xs mx-auto text-sm">Masa depanmu dimulai dari koin pertama yang kamu simpan hari ini. Ayo buat rencana!</p>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className={cn(getBtnClass(), "px-8 py-4")}
              >
                Mulai Tabungan Baru
              </button>
            </div>
          ) : (
            goals.map(goal => (
              <GoalCard 
                key={goal.id} 
                goal={goal} 
                theme={settings.theme}
                onAdd={() => {
                  setSelectedGoal(goal);
                  setIsTransactionModalOpen(true);
                  setTransactionType('deposit');
                }}
                onSubtract={() => {
                  setSelectedGoal(goal);
                  setIsTransactionModalOpen(true);
                  setTransactionType('withdrawal');
                }}
                onDelete={() => setGoalToDelete(goal)}
              />
            ))
          )}
        </div>

        {/* Tips Section */}
        <section className="mb-20">
          <h3 className="text-xs uppercase font-black tracking-widest mb-6 border-b border-current/10 pb-2">Tips Hemat & Menabung</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { title: 'Aturan 50/30/20', desc: '50% Kebutuhan, 30% Keinginan, dan 20% Tabungan.', icon: <PieChart size={24} /> },
              { title: 'Pencatatan Rutin', desc: 'Catat setiap pengeluaran sekecil apapun itu.', icon: <CheckCircle2 size={24} /> },
              { title: 'Target Realistis', desc: 'Mulai dari yang kecil tapi konsisten setiap hari.', icon: <TrendingUp size={24} /> }
            ].map((tip, i) => (
              <div key={i} className={cn("p-6", getCardClass())}>
                <div className="mb-4 text-blue-500">{tip.icon}</div>
                <h4 className="font-bold mb-2">{tip.title}</h4>
                <p className="text-xs opacity-60 leading-relaxed">{tip.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAB */}
        {goals.length > 0 && (
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className={cn(
              "fixed bottom-8 right-8 w-16 h-16 flex items-center justify-center rounded-full z-40 transition-all active:scale-90",
              settings.theme === 'brutalist' ? "bg-yellow-400 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]" : "bg-zinc-900 text-white shadow-xl"
            )}
          >
            <Plus size={32} />
          </button>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isAddModalOpen && (
          <AddGoalModal 
            onClose={() => setIsAddModalOpen(false)} 
            onAdd={addGoal} 
            theme={settings.theme}
          />
        )}
        {isTransactionModalOpen && selectedGoal && (
          <TransactionModal 
            goal={selectedGoal}
            type={transactionType}
            onClose={() => setIsTransactionModalOpen(false)}
            onConfirm={(amount, note) => addTransaction(selectedGoal.id, amount, transactionType, note)}
            theme={settings.theme}
            setType={setTransactionType}
          />
        )}
        {isSettingsOpen && (
          <SettingsModal 
            settings={settings}
            setSettings={setSettings}
            onClose={() => setIsSettingsOpen(false)}
            onRequestNotify={requestNotificationPermission}
          />
        )}
        {goalToDelete && (
          <DeleteConfirmModal 
            goal={goalToDelete}
            onConfirm={() => deleteGoal(goalToDelete.id)}
            onClose={() => setGoalToDelete(null)}
            theme={settings.theme}
          />
        )}
      </AnimatePresence>
    </ThemeWrapper>
  );
}

// Sub-components

function DeleteConfirmModal({ goal, onConfirm, onClose, theme }: { goal: Goal, onConfirm: () => void, onClose: () => void, theme: ThemeType }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className={cn(
          "w-full max-w-sm relative z-10 p-8 text-center",
          theme === 'brutalist' ? "brutal-card !bg-white !shadow-[12px_12px_0px_0px_#FF4444]" : 
          theme === 'glass' ? "glass-card !bg-zinc-900/95 text-white" : "std-card"
        )}
      >
        <div className="mb-6 inline-flex p-4 bg-red-100 text-red-600 rounded-full animate-pulse">
          <Trash2 size={48} />
        </div>
        <h3 className="text-2xl font-display font-black mb-3 uppercase">Hapus Celengan?</h3>
        <p className="text-sm opacity-60 mb-8">
          Kamu akan menghapus <span className="font-bold underline">{goal.name}</span>. Semua riwayat tabungan akan hilang selamanya!
        </p>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={onConfirm}
            className={cn(
              "w-full py-4 font-black uppercase text-white bg-red-600 active:scale-95 transition-all",
              theme === 'brutalist' ? "border-4 border-black" : "rounded-xl"
            )}
          >
            Yakin, Hapus Saja
          </button>
          <button 
            onClick={onClose}
            className={cn(
              "w-full py-4 font-bold opacity-60 hover:opacity-100",
              theme === 'retro' ? "font-mono" : ""
            )}
          >
            Batal
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function GoalCard({ goal, theme, onAdd, onSubtract, onDelete }: { goal: Goal, theme: ThemeType, onAdd: () => void, onSubtract: () => void, onDelete: () => void, key?: string }) {
  const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
  const colorTag = useMemo(() => {
    const colors = ['bg-pink-400', 'bg-blue-400', 'bg-yellow-400', 'bg-purple-400', 'bg-green-400'];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);
  
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onClick={onAdd}
      className={cn(
        "relative overflow-hidden group p-6 flex flex-col h-full transition-all cursor-pointer",
        theme === 'brutalist' ? "brutal-card !shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] hover:!shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] hover:-translate-y-1" : 
        theme === 'glass' ? "glass-card hover:bg-white/10" : 
        theme === 'retro' ? "retro-card hover:translate-x-1 hover:-translate-y-1" :
        theme === 'bento' ? "bento-card hover:shadow-xl hover:scale-[1.02]" : "std-card hover:shadow-lg hover:-translate-y-1"
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="min-w-0 flex-1">
          {(theme === 'brutalist' || theme === 'retro') && (
            <span className={cn("text-[10px] font-bold border border-[#141414] px-2 py-0.5 uppercase mb-2 inline-block", theme === 'retro' ? 'bg-cyan-400' : colorTag)}>
              {theme === 'retro' ? 'CELENGAN' : 'Tabungan'}
            </span>
          )}
          <h3 className={cn(
            "font-display font-black text-2xl truncate pr-2",
            theme === 'brutalist' ? "uppercase italic" : theme === 'retro' ? "font-mono" : ""
          )}>{goal.name}</h3>
        </div>
        <div className={cn(
          "w-20 h-20 shrink-0 overflow-hidden bg-zinc-100 flex items-center justify-center shadow-inner",
          theme === 'brutalist' || theme === 'retro' ? "border-2 border-[#141414]" : "rounded-2xl"
        )}>
          {goal.image ? (
            <img src={goal.image} alt={goal.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <ImageIcon className="opacity-20" size={32} />
          )}
        </div>
      </div>

      <p className={cn(
        "text-xs font-medium opacity-70 mb-6 line-clamp-2 min-h-[32px]",
        theme === 'retro' ? 'bg-white/50 p-2 border border-zinc-400 text-black' : ''
      )}>
        {goal.description || 'Menabung untuk masa depan. Tetap konsisten!'}
      </p>

      <div className="mt-auto">
        <div className="mb-6">
          <div className="flex justify-between text-[10px] font-black uppercase mb-1">
            <span>Progress ({Math.round(progress)}%)</span>
            <span className="opacity-60 tabular-nums">{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</span>
          </div>
          
          <div className={cn(
            "w-full bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden",
            theme === 'brutalist' || theme === 'retro' ? "border-2 border-[#141414] h-6" : "h-3 rounded-full"
          )}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={cn(
                "h-full transition-all",
                progress >= 100 ? "bg-green-500" : (theme === 'brutalist' ? "bg-blue-400" : theme === 'retro' ? 'bg-pink-500' : "bg-blue-500"),
                theme === 'brutalist' || theme === 'retro' ? "border-r-2 border-[#141414]" : ""
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3 relative z-30">
          <button 
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSubtract(); }}
            className={cn(
              "flex items-center justify-center py-3 font-bold cursor-pointer transition-all",
              theme === 'brutalist' ? "brutal-btn" : 
              theme === 'retro' ? "retro-btn" : 
              theme === 'bento' ? "bento-btn" : "bg-zinc-100 dark:bg-zinc-800 rounded-xl"
            )}
          >
            KURANGI
          </button>
          <button 
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className={cn(
              "flex items-center justify-center py-3 font-bold cursor-pointer transition-all",
              theme === 'brutalist' ? "brutal-btn brutal-btn-primary" : 
              theme === 'retro' ? "retro-btn !bg-cyan-300" :
              theme === 'bento' ? "bento-btn !bg-zinc-900 !text-white" : "bg-zinc-900 text-white rounded-xl shadow-lg"
            )}
          >
            TAMBAH
          </button>
        </div>

        <button 
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => { 
            e.preventDefault();
            e.stopPropagation(); 
            onDelete(); 
          }}
          className={cn(
            "w-full flex items-center justify-center py-2 text-[10px] font-black transition-all cursor-pointer z-20",
            theme === 'brutalist' ? "border-2 border-dashed border-red-500/30 mt-2 text-red-500 hover:bg-red-50" : "text-red-500 opacity-40 hover:opacity-100"
          )}
        >
          <Trash2 size={12} className="mr-2" /> HAPUS TABUNGAN
        </button>
      </div>
      
      {progress >= 100 && (
        <div className="absolute top-2 right-2 rotate-12">
          <span className={cn(
            "text-[10px] font-black px-2 py-1 border-2 border-[#141414]",
            theme === 'retro' ? 'bg-cyan-400 text-black' : 'bg-yellow-400 text-[#141414]'
          )}>LUNAS!</span>
        </div>
      )}
    </motion.div>
  );
}

function AddGoalModal({ onClose, onAdd, theme }: { onClose: () => void, onAdd: (g: any) => void, theme: ThemeType }) {
  const [formData, setFormData] = useState({
    name: '',
    targetAmount: '',
    description: '',
    image: ''
  });
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({ ...prev, image: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className={cn(
          "w-full max-w-md relative z-10 p-8 max-h-[90dvh] overflow-y-auto",
          theme === 'brutalist' ? "brutal-card !shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] dark:!shadow-[16px_16px_0px_0px_rgba(255,255,255,1)]" : 
          theme === 'glass' ? "glass-card !bg-zinc-900/90 text-white" : 
          theme === 'retro' ? "retro-card text-black" :
          theme === 'bento' ? "bento-card !bg-white dark:!bg-zinc-900 border-0 shadow-2xl" : "std-card !bg-white dark:!bg-zinc-900"
        )}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className={cn("text-2xl font-display font-bold", theme === 'retro' ? 'font-mono' : '')}>Buat Tabungan</h2>
          <button onClick={onClose}><X /></button>
        </div>
        
        <div className="space-y-4">
          {/* Photo Dropzone */}
          <div>
            <label className="block text-xs uppercase font-bold mb-2">Foto Tabungan</label>
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById('fileInput')?.click()}
              className={cn(
                "w-full h-32 border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative text-black",
                isDragging ? "bg-blue-500/20 border-blue-500" : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800",
                theme === 'brutalist' ? "border-solid border-2 border-black rounded-none" : "rounded-2xl"
              )}
            >
              {formData.image ? (
                <>
                  <img src={formData.image} className="w-full h-full object-cover" alt="Preview" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-bold">Ganti Foto</p>
                  </div>
                </>
              ) : (
                <>
                  <ImageIcon className="opacity-40 mb-2" size={32} />
                  <p className="text-[10px] uppercase font-bold opacity-60">Drag & Drop atau Klik</p>
                </>
              )}
              <input 
                id="fileInput"
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase font-bold mb-1">Nama Tabungan</label>
            <input 
              autoFocus
              className="w-full bg-transparent border-2 border-current px-4 py-2"
              placeholder="Contoh: Beli PS5"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs uppercase font-bold mb-1">Target Dana (Rp)</label>
            <input 
              type="number"
              className="w-full bg-transparent border-2 border-current px-4 py-2"
              placeholder="0"
              value={formData.targetAmount}
              onChange={e => setFormData({...formData, targetAmount: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs uppercase font-bold mb-1">Deskripsi Opsional</label>
            <textarea 
              className="w-full bg-transparent border-2 border-current px-4 py-2"
              rows={2}
              placeholder="Semangat menabung!"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
        </div>

        <button 
          onClick={() => {
            if (!formData.name || !formData.targetAmount) return;
            onAdd({...formData, targetAmount: Number(formData.targetAmount)});
          }}
          className={cn(
            "w-full mt-8 py-4 font-display font-bold text-lg uppercase transition-all",
            theme === 'brutalist' ? "bg-black text-white dark:bg-white dark:text-black border-2 border-black" : 
            theme === 'retro' ? "retro-btn !bg-cyan-400 !text-black !text-lg" :
            theme === 'bento' ? "bg-zinc-900 text-white rounded-2xl" : "bg-blue-600 text-white rounded-xl"
          )}
        >
          Mulai Menabung
        </button>
      </motion.div>
    </div>
  );
}

function TransactionModal({ goal, type, onClose, onConfirm, theme, setType }: { 
  goal: Goal, type: 'deposit' | 'withdrawal', onClose: () => void, onConfirm: (a: number, n: string) => void, theme: ThemeType, setType: (t: any) => void 
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
        className={cn(
          "w-full max-w-md relative z-10 p-8",
          theme === 'brutalist' ? "brutal-card" : 
          theme === 'glass' ? "glass-card !bg-zinc-900/95 text-white" : "std-card"
        )}
      >
        <div className="flex gap-2 mb-6 p-1 bg-zinc-100 dark:bg-white/5 rounded-xl">
          <button 
            onClick={() => setType('deposit')}
            className={cn(
              "flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all",
              type === 'deposit' ? "bg-green-500 text-white shadow-lg" : "opacity-50"
            )}
          >
            <ArrowUpRight size={18} /> Tabung
          </button>
          <button 
            onClick={() => setType('withdrawal')}
            className={cn(
              "flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all",
              type === 'withdrawal' ? "bg-red-500 text-white shadow-lg" : "opacity-50"
            )}
          >
            <ArrowDownLeft size={18} /> Ambil
          </button>
        </div>

        <h3 className="text-xl font-display font-bold mb-4">{goal.name}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase font-bold mb-1">Jumlah (Rp)</label>
            <input 
              autoFocus
              type="number"
              step="any"
              className="w-full bg-transparent border-b-4 border-current text-4xl font-display font-bold focus:outline-none placeholder:opacity-20"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase font-bold mb-1">Catatan</label>
            <input 
              className="w-full bg-transparent border-2 border-current px-4 py-2"
              placeholder="Ketik catatan..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        <button 
          onClick={() => {
            if (!amount) return;
            onConfirm(Number(amount), note);
          }}
          className={cn(
            "w-full mt-8 py-4 font-display font-bold text-lg uppercase",
            type === 'deposit' ? "bg-green-600 text-white" : "bg-red-600 text-white",
            theme === 'brutalist' ? "border-4 border-black" : "rounded-xl"
          )}
        >
          Konfirmasi {type === 'deposit' ? 'Tabung' : 'Ambil'}
        </button>

        {/* History Preview */}
        {goal.transactions.length > 0 && (
          <div className="mt-8 pt-6 border-t border-current/10">
            <h4 className="text-xs uppercase font-bold mb-3 opacity-50">Riwayat Terakhir</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {goal.transactions.slice(0, 5).map(tx => (
                <div key={tx.id} className="flex justify-between text-sm py-1 border-b border-current/5 last:border-0">
                  <span className="opacity-60">{format(new Date(tx.date), 'dd/MM/yy')}</span>
                  <span className={tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'}>
                    {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function SettingsModal({ settings, setSettings, onClose, onRequestNotify }: { 
  settings: AppSettings, setSettings: (f: any) => void, onClose: () => void, onRequestNotify: () => void 
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
        className={cn(
          "w-full max-w-sm absolute right-4 top-4 bottom-4 z-10 p-8 overflow-y-auto",
          settings.theme === 'brutalist' ? "brutal-card !bg-white dark:!bg-zinc-900" : 
          settings.theme === 'glass' ? "glass-card !bg-zinc-900/90 text-white" : "std-card"
        )}
      >
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-display font-bold tracking-tighter">Pengaturan</h2>
          <button onClick={onClose}><X /></button>
        </div>

        <div className="space-y-8">
          {/* Theme */}
          <section>
            <h3 className="text-xs uppercase font-bold mb-4 tracking-widest opacity-50">Tema Visual</h3>
            <div className="grid grid-cols-1 gap-2">
              {(['brutalist', 'glass', 'standard', 'retro', 'bento'] as ThemeType[]).map(t => (
                <button 
                  key={t}
                  onClick={() => setSettings({...settings, theme: t})}
                  className={cn(
                    "w-full py-3 px-4 flex justify-between items-center text-left transition-all rounded-lg",
                    settings.theme === t ? "bg-black text-white dark:bg-white dark:text-black font-bold" : "bg-black/5 dark:bg-white/5"
                  )}
                >
                  <span className="capitalize">{t === 'retro' ? 'Retro / Y2K' : t === 'bento' ? 'Bento Grid' : t}</span>
                  {settings.theme === t && <div className="w-2 h-2 rounded-full bg-current" />}
                </button>
              ))}
            </div>
          </section>

          {/* Mode */}
          <section>
            <h3 className="text-xs uppercase font-bold mb-4 tracking-widest opacity-50">Tampilan</h3>
            <button 
              onClick={() => setSettings({...settings, mode: settings.mode === 'light' ? 'dark' : 'light'})}
              className="w-full flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-xl"
            >
              <div className="flex items-center gap-3">
                {settings.mode === 'light' ? <Sun /> : <Moon />}
                <span className="font-bold">{settings.mode === 'light' ? 'Mode Terang' : 'Mode Gelap'}</span>
              </div>
              <div className={cn(
                "w-12 h-6 rounded-full relative transition-colors duration-300",
                settings.mode === 'dark' ? "bg-blue-600" : "bg-zinc-300"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300",
                  settings.mode === 'dark' ? "right-1" : "left-1"
                )} />
              </div>
            </button>
          </section>

          {/* Notifications */}
          <section>
            <h3 className="text-xs uppercase font-bold mb-4 tracking-widest opacity-50">Notifikasi PWA</h3>
            <div className="space-y-4">
              <button 
                onClick={onRequestNotify}
                disabled={settings.notificationsEnabled}
                className={cn(
                  "w-full p-4 rounded-xl flex items-center justify-between text-left",
                  settings.notificationsEnabled ? "bg-green-500/10 text-green-600 opacity-50" : "bg-black/5 dark:bg-white/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <Bell />
                  <span className="font-bold">Aktifkan Notifikasi</span>
                </div>
                <span className="text-xs font-bold">{settings.notificationsEnabled ? 'AKTIF' : 'IZINKAN'}</span>
              </button>
              
              <div className="p-4 bg-black/5 dark:bg-white/5 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Pengingat Menabung</span>
                  <input 
                    type="checkbox" 
                    checked={settings.reminderActive}
                    onChange={e => setSettings({...settings, reminderActive: e.target.checked})}
                    className="w-5 h-5"
                  />
                </div>
                <p className="text-[10px] opacity-60">Pengingat harian untuk membantu kamu mencapai target lebih cepat!</p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-20 pt-10 border-t border-current/10 text-center">
          <p className="text-[10px] opacity-30 font-mono">CELENGAN DIGITAL V1.0</p>
        </div>
      </motion.div>
    </div>
  );
}
