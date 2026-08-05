import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, BarChart3, HandCoins, Hammer, Layers3 } from 'lucide-react';
import { db } from '../../Firebase/config';

const ProjectDetails = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [siteType, setSiteType] = useState('');

  useEffect(() => {
    const loadProject = async () => {
      try {
        const snapshot = await getDoc(doc(db, 'projects', projectId));
        if (snapshot.exists()) {
          setProjectName(snapshot.data().name || 'Project Workspace');
          setClientName(snapshot.data().clientName || '');
          setSiteType(snapshot.data().siteType || '');
        } else {
          setProjectName('Project Workspace');
          setClientName('');
          setSiteType('');
        }
      } catch (error) {
        console.error('Error loading project details:', error);
        setProjectName('Project Workspace');
        setClientName('');
        setSiteType('');
      }
    };

    loadProject();
  }, [projectId]);

  const tabs = [
    { path: 'materials', label: 'Materials', icon: Layers3 },
    { path: 'labour', label: 'Labour', icon: Hammer },
    { path: 'payments', label: 'Payments', icon: HandCoins },
    { path: 'reports', label: 'Reports & Analysis', icon: BarChart3 }
  ];

  return (
    <div className="space-y-5">
      <section className="glass-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Current Project Workspace</p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-900">{projectName || 'Loading...'}</h1>
            <p className="mt-1 text-sm text-zinc-600">Client: {clientName || 'Not specified'}</p>
            <p className="mt-1 text-sm text-zinc-600">Site Type: {siteType || 'Not specified'}</p>
            <p className="mt-1 text-sm text-zinc-600">All project pages are grouped below for a clear and easy workflow.</p>
          </div>

          <button type="button" onClick={() => navigate('/')} className="neutral-btn self-start">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-blue-300 bg-blue-100 text-blue-800'
                    : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                }`
              }
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </NavLink>
          ))}
        </div>
      </section>

      <Outlet context={{ projectName }} />
    </div>
  );
};

export default ProjectDetails;



