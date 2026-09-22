import React, { useState, useEffect } from 'react';
import {
  Plus,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Truck,
  Coins,
  ArrowRightLeft,
  DollarSign,
  Receipt,
} from 'lucide-react';

interface MobileFloatingActionButtonProps {
  onOpenMoneyIn: () => void;
  onOpenMoneyOut: () => void;
  onOpenClientInvoice: () => void;
  onOpenPurchase: () => void;
  onOpenExpense: () => void;
  onOpenTransfer: () => void;
}

export const MobileFloatingActionButton: React.FC<MobileFloatingActionButtonProps> = ({
  onOpenMoneyIn,
  onOpenMoneyOut,
  onOpenClientInvoice,
  onOpenPurchase,
  onOpenExpense,
  onOpenTransfer,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close when pressing Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleAction = (callback: () => void) => {
    setIsOpen(false);
    callback();
  };

  const actionItems = [
    {
      id: 'money-in',
      title: 'Money In (Receipt)',
      desc: 'Customer payment or direct cash receipt',
      icon: <ArrowDownLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200',
      action: onOpenMoneyIn,
    },
    {
      id: 'client-invoice',
      title: 'Client Invoice (Bill)',
      desc: 'Raise project progress claim or customer billing',
      icon: <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200',
      action: onOpenClientInvoice,
    },
    {
      id: 'money-out',
      title: 'Money Out (Payment)',
      desc: 'Direct payment to supplier, subbie, or party',
      icon: <ArrowUpRight className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200',
      action: onOpenMoneyOut,
    },
    {
      id: 'purchase',
      title: 'Purchase Bill (Vendor)',
      desc: 'Record materials, subcontracts, or plant hire bill',
      icon: <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      bg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200',
      action: onOpenPurchase,
    },
    {
      id: 'expense',
      title: 'Direct Site Expense',
      desc: 'Petty cash, site fuel, food, or labor wages',
      icon: <Coins className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
      bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200',
      action: onOpenExpense,
    },
    {
      id: 'transfer',
      title: 'Account Transfer',
      desc: 'Internal transfer between Bank & Cash accounts',
      icon: <ArrowRightLeft className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />,
      bg: 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200',
      action: onOpenTransfer,
    },
  ];

  return (
    <>
      {/* Dimmed Overlay when Speed-Dial is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 lg:hidden print:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating Action Speed-Dial Container */}
      <div className="fixed bottom-20 right-4 z-40 lg:hidden print:hidden flex flex-col items-end">
        {/* Speed Dial Menu Items */}
        {isOpen && (
          <div className="flex flex-col items-end gap-2.5 mb-3 w-[88vw] max-w-[340px] animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2.5 space-y-1.5 backdrop-blur-md">
              <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    New Transaction
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Select transaction category to open form
                  </p>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold">
                  OMR
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1 pt-1 max-h-[60vh] overflow-y-auto">
                {actionItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAction(item.action)}
                    className={`flex items-center gap-3 p-3 min-h-[50px] rounded-xl border text-left transition-all active:scale-98 cursor-pointer touch-target-min ${item.bg}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 shadow-xs flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-700/60">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{item.title}</div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* The Main Round Floating (+) Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close transaction options' : 'Add new transaction'}
          className={`w-14 h-14 rounded-full shadow-[0_8px_24px_rgba(79,70,229,0.35)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
            isOpen
              ? 'bg-rose-600 hover:bg-rose-700 text-white rotate-45 ring-4 ring-rose-100 dark:ring-rose-950/60'
              : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white hover:scale-105 ring-4 ring-indigo-100 dark:ring-indigo-950/60'
          }`}
        >
          <Plus className="w-7 h-7 stroke-[2.5]" />
        </button>
      </div>
    </>
  );
};
