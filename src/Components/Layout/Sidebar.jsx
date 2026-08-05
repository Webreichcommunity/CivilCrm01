import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowLeft, BarChart3, HandCoins, Hammer, Layers3 } from 'lucide-react';

const Sidebar = ({ isOpen, onClose, projectId, currentProjectName }) => {
  const navItems = [
    { path: `/project/${projectId}/materials`, icon: Layers3, label: 'Materials' },
    { path: `/project/${projectId}/labour`, icon: Hammer, label: 'Labour' },
    { path: `/project/${projectId}/payments`, icon: HandCoins, label: 'Payments' },
    { path: `/project/${projectId}/reports`, icon: BarChart3, label: 'Reports & Analysis' }
  ];

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={onClose}
          aria-label="Close project menu"
        />
      )}

      <aside
        className={`fixed left-2 top-24 z-30 h-[calc(100vh-7rem)] w-72 transform rounded-2xl border border-zinc-700/50 bg-zinc-900/95 p-4 text-zinc-100 shadow-xl transition duration-300 lg:sticky lg:left-0 lg:top-24 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-[120%]'
        }`}
      >
        <div className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800/80 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Open Project</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">{currentProjectName || 'Loading...'}</p>
        </div>

        <nav className="space-y-2">
          <NavLink to="/" className="flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-blue-400 hover:text-white" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </NavLink>

          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-blue-400 bg-blue-500/20 text-blue-100'
                    : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;



