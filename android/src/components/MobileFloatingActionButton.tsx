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
      icon: <FileText className="w-4 h-4 text-white" />,
      gradient: 'from-blue-500 to-blue-600',
      shadow: 'shadow-[0_10px_20px_rgba(37,99,235,0.35)]',
      action: onOpenClientInvoice,
    },
    {
      id: 'money-in',
      title: 'Receipt from Client',
      icon: <ArrowDownLeft className="w-4 h-4 text-white" />,
      gradient: 'from-emerald-500 to-emerald-600',
      shadow: 'shadow-[0_10px_20px_rgba(5,150,105,0.35)]',
      action: onOpenMoneyIn,
    },
    {
      id: 'purchase',
      title: 'Vendor Purchase Bill',
      icon: <Truck className="w-4 h-4 text-white" />,
      gradient: 'from-amber-500 to-amber-600',
      shadow: 'shadow-[0_10px_20px_rgba(217,119,6,0.35)]',
      action: onOpenPurchase,
    },
    {
      id: 'money-out',
      title: 'Payment to Vendors',
      icon: <ArrowUpRight className="w-4 h-4 text-white" />,
      gradient: 'from-rose-400 to-rose-600',
      shadow: 'shadow-[0_10px_20px_rgba(225,29,72,0.35)]',
      action: onOpenMoneyOut,
    },
    {
      id: 'expense',
      title: 'Direct Site Expense',
      icon: <Coins className="w-4 h-4 text-white" />,
      gradient: 'from-rose-400 to-rose-600',
      shadow: 'shadow-[0_10px_20px_rgba(225,29,72,0.35)]',
      action: onOpenExpense,
    },
    {
      id: 'transfer',
      title: 'Bank / Cash Transfer',
      icon: <ArrowRightLeft className="w-4 h-4 text-white" />,
      gradient: 'from-indigo-500 to-indigo-600',
      shadow: 'shadow-[0_10px_20px_rgba(79,70,229,0.35)]',
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
        {/* Speed Dial Menu Items — floating gradient pills, staggered */}
        {isOpen && (
          <div className="flex flex-col items-end gap-3 mb-4 max-h-[65vh] overflow-y-auto py-1">
            {actionItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleAction(item.action)}
                style={{ animationDelay: `${index * 30}ms` }}
                className={`shrink-0 flex items-center gap-2.5 h-12 pl-2 pr-4 rounded-full text-white bg-gradient-to-br ${item.gradient} ${item.shadow} active:scale-95 cursor-pointer touch-target-min transition-transform animate-in slide-in-from-bottom-3 fade-in duration-200 ${
                  index % 2 === 0 ? '-translate-x-1.5' : ''
                }`}
              >
                <span className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center shrink-0">
                  {item.icon}
                </span>
                <span className="text-sm font-semibold whitespace-nowrap">{item.title}</span>
              </button>
            ))}
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
