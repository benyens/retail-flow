import KeyboardShortcuts from "./KeyboardShortcuts";
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useApp } from '@/state/AppContext';
import BranchSelector from '@/modules/pos/components/BranchSelector';
import { NavLink } from "@/components/NavLink";

export default function MainLayout() {
  const { selectedBranch, selectedCashRegister } = useApp();

  // Show branch/register selector if not selected
  if (!selectedBranch || !selectedCashRegister) {
    return <BranchSelector />;
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="flex justify-end px-6 border-b"><KeyboardShortcuts /></div>
        <Outlet />
      </main>
    </div>
  );
}
