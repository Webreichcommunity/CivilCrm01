import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import {
  BriefcaseBusiness,
  Hammer,
  HandCoins,
  Layers3,
  Plus,
  ReceiptText,
  Search,
  TrendingUp,
  Zap
} from 'lucide-react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { db } from '../../Firebase/config';
import ProjectCard from './ProjectCard';
import CreateProjectModal from './CreateProjectModal';
import { getAllocatedExpenseTotalForProject } from '../../utils/projectFinance';

/* ─── helpers ─── */
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'AD';

const formatCurrency = (value) => `INR ${Number(value || 0).toLocaleString('en-IN')}`;

/* ─── animation ─── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] } }
});

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [projects, setProjects]       = useState([]);
  const [companyExpenses, setCompanyExpenses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');

  const userName = useMemo(() => {
    if (user?.displayName?.trim()) return user.displayName.trim();
    if (user?.email) return user.email.split('@')[0];
    return 'Admin';
  }, [user]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const [snap, expenseSnap] = await Promise.all([
        getDocs(collection(db, 'projects')),
        getDocs(collection(db, 'expenses'))
      ]);
      const base = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const expenses = expenseSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const full = await Promise.all(
        base.map(async p => {
          const [mat, lab, pay] = await Promise.all([
            getDocs(collection(db, `projects/${p.id}/materials`)),
            getDocs(collection(db, `projects/${p.id}/labour`)),
            getDocs(collection(db, `projects/${p.id}/payments`)),
          ]);
          const materialCost = mat.docs.reduce((sum, entry) => sum + Number(entry.data().finalAmount || 0), 0);
          const labourCost = lab.docs.reduce((sum, entry) => sum + Number(entry.data().amount || 0), 0);
          const paymentReceived = pay.docs
            .filter((entry) => entry.data().paymentType === 'in')
            .reduce((sum, entry) => sum + Number(entry.data().amount || 0), 0);
          const paymentOut = pay.docs
            .filter((entry) => entry.data().paymentType === 'out')
            .reduce((sum, entry) => sum + Number(entry.data().amount || 0), 0);
          const allocatedExpenseCost = getAllocatedExpenseTotalForProject(expenses, p.id);
          const recent = [
            ...mat.docs.map((entry) => ({ id: entry.id, projectName: p.name, type: 'Material', amount: entry.data().finalAmount, date: entry.data().dateTime, tone: 'slate' })),
            ...lab.docs.map((entry) => ({ id: entry.id, projectName: p.name, type: 'Labour', amount: entry.data().amount, date: entry.data().date, tone: 'blue' })),
            ...pay.docs.map((entry) => ({
              id: entry.id,
              projectName: p.name,
              type: entry.data().paymentType === 'in' ? 'Payment In' : 'Payment Out',
              amount: entry.data().amount,
              date: entry.data().dateTime,
              tone: entry.data().paymentType === 'in' ? 'emerald' : 'red'
            }))
          ];

          return { ...p, materialCount: mat.size, labourCount: lab.size, paymentCount: pay.size, materialCost, labourCost, paymentReceived, paymentOut, allocatedExpenseCost, recent };
        })
      );
      setCompanyExpenses(expenses);
      setProjects(full.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)));
    } catch (e) {
      console.error('Error fetching projects:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProjects();
  }, []);

  const handleCreateProject = async ({ projectName, clientName, siteType }) => {
    try {
      await addDoc(collection(db, 'projects'), {
        name: projectName, clientName, siteType, status: 'active',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      fetchProjects();
    } catch (e) { console.error(e); }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Delete this project? This action cannot be undone.')) return;
    try { await deleteDoc(doc(db, 'projects', id)); fetchProjects(); }
    catch (e) { console.error(e); }
  };

  const handleUpdateProject = async (id, data) => {
    try {
      await updateDoc(doc(db, 'projects', id), { ...data, updatedAt: new Date().toISOString() });
      fetchProjects();
    } catch (e) { console.error(e); }
  };

  const filteredProjects = useMemo(() => {
    const kw = searchTerm.toLowerCase().trim();
    if (!kw) return projects;
    return projects.filter(p =>
      p.name?.toLowerCase().includes(kw) || p.clientName?.toLowerCase().includes(kw)
    );
  }, [projects, searchTerm]);

  const totals = useMemo(() => {
    const materialCost = projects.reduce((sum, project) => sum + Number(project.materialCost || 0), 0);
    const labourCost = projects.reduce((sum, project) => sum + Number(project.labourCost || 0), 0);
    const paymentReceived = projects.reduce((sum, project) => sum + Number(project.paymentReceived || 0), 0);
    const paymentOut = projects.reduce((sum, project) => sum + Number(project.paymentOut || 0), 0);
    const otherExpenses = companyExpenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const totalSpend = materialCost + labourCost + paymentOut + otherExpenses;

    return {
      materialCost,
      labourCost,
      paymentReceived,
      paymentOut,
      otherExpenses,
      totalSpend,
      cashBalance: paymentReceived - totalSpend
    };
  }, [projects, companyExpenses]);

  const stats = useMemo(() => [
    { title: 'Total Projects', value: projects.length, icon: BriefcaseBusiness },
    { title: 'Payment Received', value: formatCurrency(totals.paymentReceived), icon: HandCoins },
    { title: 'Material Spend', value: formatCurrency(totals.materialCost), icon: Layers3 },
    { title: 'Labour Spend', value: formatCurrency(totals.labourCost), icon: Hammer },
    { title: 'Other Expenses', value: formatCurrency(totals.otherExpenses), icon: ReceiptText },
  ], [projects.length, totals]);

  const topProject = useMemo(() => {
    if (!projects.length) return null;
    return [...projects].sort(
      (a, b) =>
        ((b.materialCount || 0) + (b.labourCount || 0) + (b.paymentCount || 0)) -
        ((a.materialCount || 0) + (a.labourCount || 0) + (a.paymentCount || 0))
    )[0];
  }, [projects]);

  /* ─── loading ─── */
  if (loading) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-4">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-600" />
        </div>
        <p className="animate-pulse text-sm font-medium text-zinc-400">Loading your projects...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">

      {/* ── HERO HEADER ── */}
      <Motion.section
        {...fadeUp(0)}
        whileHover={{ scale: 1.02, transition: { duration: 0.3 } }}
        className="relative overflow-hidden rounded-2xl p-6 shadow-lg shadow-blue-100 md:p-8 backdrop-blur-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.94), rgba(15, 23, 42, 0.92))'
        }}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -right-4 h-36 w-36 rounded-full bg-white/10" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/25 text-base font-bold text-white ring-2 ring-white/30 md:h-14 md:w-14 md:text-lg">
              {initials(userName)}
            </div>
            <div>
              <p className="text-sm font-medium text-blue-100">{greeting()},</p>
              <h1 className="text-xl font-bold text-white md:text-2xl">{userName}</h1>
              <p className="mt-0.5 hidden text-sm text-blue-100 sm:block">
                Manage all your projects, materials, labour, payments, and reports.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <div className="relative flex-1 md:min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-xl border-0 bg-white/20 pl-9 pr-3 text-sm text-white placeholder-blue-100 outline-none ring-2 ring-transparent backdrop-blur-sm transition focus:bg-white/30 focus:ring-white/40"
                placeholder="Search project or client..."
              />
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              New Project
            </button>
            <button
              type="button"
              onClick={() => navigate('/expenses')}
              className="flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
            >
              <ReceiptText className="h-4 w-4" />
              Other Expenses
            </button>
          </div>
        </div>
      </Motion.section>

      {/* Stats grid */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {stats.map((stat, i) => (
          <Motion.div
            key={stat.title}
            {...fadeUp(0.08 + i * 0.06)}
            whileHover={{ y: -4, scale: 1.015, transition: { duration: 0.22 } }}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all duration-300 hover:border-blue-200 hover:shadow-md hover:shadow-blue-100/50"
            style={{ WebkitBackdropFilter: 'blur(16px)' }}
          >
            {/* top shine edge */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />
            <div className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-blue-400/0 blur-2xl transition-all duration-500 group-hover:bg-blue-400/15" />

            <div className="mb-3 inline-flex rounded-xl bg-blue-600/10 p-2.5 ring-1 ring-blue-600/20">
              <stat.icon className="h-5 w-5 text-blue-700" />
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              {stat.title}
            </p>
            <p className="mt-1 break-words text-2xl font-bold text-zinc-900 md:text-3xl">{stat.value}</p>
          </Motion.div>
        ))}
      </section>

      {/* ── MOST ACTIVE PROJECT ── */}
      <AnimatePresence>
        {topProject && (
          <Motion.section
            initial={{ opacity: 0, scaleY: 0.9 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 shadow-sm shadow-blue-200">
                <Zap className="h-4 w-4 text-white" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Most active project</p>
                <p className="font-semibold text-zinc-900">{topProject.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start rounded-xl bg-white/70 px-3 py-1.5 text-sm text-zinc-600 shadow-sm sm:self-auto">
              <TrendingUp className="h-4 w-4 text-blue-700" />
              <span className="font-medium text-zinc-800">
                {(topProject.materialCount || 0) + (topProject.labourCount || 0) + (topProject.paymentCount || 0)}
              </span>
              &nbsp;total entries
            </div>
          </Motion.section>
        )}
      </AnimatePresence>

      {/* ── SECTION HEADER ── */}
      <Motion.div {...fadeUp(0.32)} className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-900">All Projects</h2>
          <p className="text-sm text-zinc-500">
            {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
            {searchTerm ? ` matching "${searchTerm}"` : ' total'}
          </p>
        </div>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs font-medium text-blue-700 transition hover:text-blue-800"
          >
            Clear filter ×
          </button>
        )}
      </Motion.div>

      {/* Project list */}
      <AnimatePresence mode="popLayout">
        {filteredProjects.length > 0 ? (
          <section className="space-y-3">
            {filteredProjects.map((project, i) => (
              <Motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <ProjectCard project={project} onDelete={handleDeleteProject} onUpdate={handleUpdateProject} />
              </Motion.div>
            ))}
          </section>
        ) : (
          <Motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-16 text-center"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
              <BriefcaseBusiness className="h-7 w-7 text-blue-700" />
            </div>
            <p className="font-semibold text-zinc-700">
              {searchTerm ? 'No projects matched your search' : 'No projects yet'}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {searchTerm ? 'Try a different keyword.' : 'Create your first project to get started.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-800 active:scale-95"
              >
                <Plus className="h-4 w-4" /> New Project
              </button>
            )}
          </Motion.div>
        )}
      </AnimatePresence>

      <CreateProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreate={handleCreateProject} />
    </div>
  );
};

export default Dashboard;
