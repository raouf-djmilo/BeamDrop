import React from 'react';
import { Zap, QrCode, Radio, Building2, Menu, Lock } from 'lucide-react';
import { MainTab } from './Sidebar';
import { useAuth } from '../context/AuthContext';

interface MobileBottomNavProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  onOpenMobileMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenMobileMenu
}) => {
  const { userTier } = useAuth();
  const quickItems: Array<{
    id: MainTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    activeColor: string;
  }> = [
    { id: 'sender', label: 'Send', icon: Zap, activeColor: 'text-sky-600' },
    { id: 'receive', label: 'Receive', icon: QrCode, activeColor: 'text-emerald-600' },
    { id: 'radar', label: 'Radar', icon: Radio, activeColor: 'text-indigo-600' },
    { id: 'workspaces', label: 'Rooms', icon: Building2, activeColor: 'text-amber-600' }
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-2xl border-t border-sky-200/80 px-2 py-1.5 flex items-center justify-around lg:hidden shadow-[0_-4px_24px_rgba(2,132,199,0.08)] pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]"
    >
      {quickItems.map((item) => {
        const isActive = activeTab === item.id;
        const Icon = item.icon;
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer min-w-[56px] min-h-[44px] ${
              isActive
                ? `${item.activeColor} font-bold scale-105`
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className={`p-1 rounded-lg relative ${isActive ? 'bg-sky-50' : ''}`}>
              <Icon className="w-5 h-5 shrink-0" />
              {(item.id === 'radar' || item.id === 'workspaces') && userTier !== 'pro' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 border border-white" />
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 leading-none">
              {item.label}
            </span>
          </button>
        );
      })}

      {/* Menu Drawer Toggle Button */}
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-600 hover:text-sky-700 transition-all cursor-pointer min-w-[56px] min-h-[44px]"
        aria-label="Open sidebar menu"
      >
        <div className="p-1 rounded-lg bg-sky-100/70 text-sky-800">
          <Menu className="w-5 h-5 shrink-0" />
        </div>
        <span className="text-[10px] font-semibold tracking-tight mt-0.5 leading-none text-sky-900">
          Menu
        </span>
      </button>
    </nav>
  );
};
