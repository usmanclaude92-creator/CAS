import React, { useState, useEffect } from 'react';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Truck,
  Coins,
  ArrowRightLeft,
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
      id: 'client-invoice',
      title: 'Client Invoice / IPC',
      icon: <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      action: onOpenClientInvoice,
    },
    {
      id: 'money-in',
      title: 'Receipt from Client',
      icon: <ArrowDownLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      action: onOpenMoneyIn,
    },
    {
      id: 'purchase',
      title: 'Vendor Purchase Bill',
      icon: <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      action: onOpenPurchase,
    },
    {
      id: 'money-out',
      title: 'Payment to Vendors',
      icon: <ArrowUpRight className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
      action: onOpenMoneyOut,
    },
    {
      id: 'expense',
      title: 'Direct Site Expense',
      icon: <Coins className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
      action: onOpenExpense,
    },
    {
      id: 'transfer',
      title: 'Bank / Cash Transfer',
      icon: <ArrowRightLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
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

      {/* Floating Action Speed-Dial Container (Positioned above M3 bottom nav bar with safe-area spacing) */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 lg:hidden print:hidden flex flex-col items-end">
        {/* Speed Dial Menu Items */}
        {isOpen && (
          <div className="flex flex-col items-end gap-2.5 mb-3 w-[88vw] max-w-[340px] animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1 max-h-[60vh] overflow-y-auto">
              {actionItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleAction(item.action)}
                    className="w-full flex items-center gap-3 px-4 py-3 min-h-[50px] text-left transition-colors active:scale-98 cursor-pointer touch-target-min hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="text-sm text-slate-800 dark:text-slate-100 truncate">
                      + {item.title}
                    </span>
                  </button>
                  {index % 2 === 1 && index !== actionItems.length - 1 && (
                    <div className="border-t border-slate-100 dark:border-slate-800" />
                  )}
                </React.Fragment>
              ))}
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
