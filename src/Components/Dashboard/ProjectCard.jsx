import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Edit2, Eye, Hammer, HandCoins, Layers3, MoreHorizontal, Trash2 } from 'lucide-react';
import { motion as Motion } from 'framer-motion';

const ProjectCard = ({ project, onDelete, onUpdate }) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const [draftClientName, setDraftClientName] = useState(project.clientName || '');
  const [draftSiteType, setDraftSiteType] = useState(project.siteType || '');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftName(project.name || '');
    setDraftClientName(project.clientName || '');
    setDraftSiteType(project.siteType || '');
  }, [project.name, project.clientName, project.siteType]);


  const shortcuts = useMemo(
    () => [
      { label: 'Materials', path: `/project/${project.id}/materials`, icon: Layers3 },
      { label: 'Labour', path: `/project/${project.id}/labour`, icon: Hammer },
      { label: 'Payments', path: `/project/${project.id}/payments`, icon: HandCoins },
      { label: 'Reports', path: `/project/${project.id}/reports`, icon: BarChart3 }
    ],
    [project.id]
  );

  const formatDate = (dateValue) => {
    if (!dateValue) return '-';
    return new Date(dateValue).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const siteTypeBadge = (value = '') => ({
    supervision: 'Supervision',
    'with-material': 'With Material',
    interior: 'Interior',
    other: 'Other'
  }[value] || 'Project');

  const formatCurrency = (value) => `INR ${Number(value || 0).toLocaleString('en-IN')}`;
  const totalOutflow = Number(project.materialCost || 0) + Number(project.labourCost || 0) + Number(project.paymentOut || 0) + Number(project.allocatedExpenseCost || 0);
  const balance = Number(project.paymentReceived || 0) - totalOutflow;

  const saveName = () => {
    const cleaned = draftName.trim();
    const cleanedClientName = draftClientName.trim();
    if ((cleaned && cleaned !== project.name) || cleanedClientName !== (project.clientName || '') || draftSiteType !== (project.siteType || '')) {
      onUpdate(project.id, { name: cleaned, clientName: cleanedClientName, siteType: draftSiteType });
    }
    setIsEditing(false);
  };

  return (
    <Motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="surface-card group relative overflow-visible border-l-4 border-l-blue-600 p-3 md:p-4"
    >
      {isEditing ? (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1.2fr_1fr_0.8fr_auto] lg:items-end">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Project</label>
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && saveName()}
              className="input-field h-10"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Client</label>
            <input
              value={draftClientName}
              onChange={(event) => setDraftClientName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && saveName()}
              className="input-field h-10"
              placeholder="Client name"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Site Type</label>
            <select value={draftSiteType} onChange={(event) => setDraftSiteType(event.target.value)} className="input-field h-10">
              <option value="">Select site type</option>
              <option value="supervision">Supervision</option>
              <option value="with-material">With Material</option>
              <option value="interior">Interior</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={saveName} className="orange-btn h-10 px-3 py-1 text-xs">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftName(project.name || '');
                setDraftClientName(project.clientName || '');
                setDraftSiteType(project.siteType || '');
                setIsEditing(false);
              }}
              className="neutral-btn h-10 px-3 py-1 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(240px,1fr)_auto_auto] xl:items-center">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                {siteTypeBadge(project.siteType)}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {project.status || 'Active'}
              </span>
            </div>
            <h3 className="truncate text-base font-semibold text-zinc-900 md:text-lg">{project.name}</h3>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span>Client: {project.clientName || 'Not specified'}</span>
              <span>Updated {formatDate(project.updatedAt)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[560px]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">In</p>
              <p className="truncate text-sm font-semibold text-emerald-700">{formatCurrency(project.paymentReceived)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Outflow</p>
              <p className="truncate text-sm font-semibold text-red-700">{formatCurrency(totalOutflow)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Other</p>
              <p className="truncate text-sm font-semibold text-slate-900">{formatCurrency(project.allocatedExpenseCost)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] text-slate-500">Balance</p>
              <p className={`truncate text-sm font-semibold ${balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(balance)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
              <Layers3 className="h-3.5 w-3.5 text-blue-700" />
              <span>{project.materialCount ?? 0}</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
              <Hammer className="h-3.5 w-3.5 text-blue-700" />
              <span>{project.labourCount ?? 0}</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
              <HandCoins className="h-3.5 w-3.5 text-blue-700" />
              <span>{project.paymentCount ?? 0}</span>
            </div>

            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => navigate(shortcut.path)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                title={shortcut.label}
              >
                <shortcut.icon className="h-4 w-4" />
              </button>
            ))}

            <button type="button" onClick={() => navigate(`/project/${project.id}/materials`)} className="orange-btn h-9 px-3 py-1.5 text-xs">
              <Eye className="h-4 w-4" />
              Open
            </button>

            <div className="relative">
              <button type="button" onClick={() => setShowMenu((prev) => !prev)} className="neutral-btn h-9 w-9 border-slate-200 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-11 z-10 w-36 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setIsEditing(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(project.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Motion.article>
  );
};

export default ProjectCard;





