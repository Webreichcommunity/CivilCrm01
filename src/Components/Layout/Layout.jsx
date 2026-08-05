import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useMatch } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../Firebase/config';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const Layout = ({ user }) => {
  const projectMatch = useMatch('/project/:projectId/*');
  const isProjectView = Boolean(projectMatch);
  const projectId = projectMatch?.params?.projectId;

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [projectName, setProjectName] = useState('');

  const userName = useMemo(() => {
    if (user?.displayName?.trim()) return user.displayName.trim();
    if (user?.email) return user.email.split('@')[0];
    return 'Admin';
  }, [user]);

  useEffect(() => {
    const loadProjectName = async () => {
      if (!projectId) {
        setProjectName('');
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, 'projects', projectId));
        setProjectName(snapshot.exists() ? snapshot.data().name || 'Current Project' : 'Current Project');
      } catch (error) {
        console.error('Error loading project name:', error);
        setProjectName('Current Project');
      }
    };

    loadProjectName();
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSidebarOpen(false);
  }, [projectId]);

  return (
    <div className="min-h-screen">
      <TopBar
        onMenuClick={() => setIsSidebarOpen((prev) => !prev)}
        showMenuButton={isProjectView}
        userName={userName}
        currentProjectName={projectName}
      />

      <div className="mx-auto flex w-full max-w-[1600px] gap-0 px-2 pb-4 pt-24 md:px-4">
        {isProjectView && (
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            projectId={projectId}
            currentProjectName={projectName}
          />
        )}

        <main className="w-full">
          <div className="px-1 md:px-2">
            <Outlet />
          </div>

          <footer className="mt-2 px-2 pb-3">
            <a
              href="https://www.webreich.in"
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card flex flex-col items-center justify-between gap-3 px-4 py-3 text-xs text-slate-600 transition hover:border-blue-300 sm:flex-row"
            >
              <p>
                Vastushobha Construction software powered by <span className="font-semibold text-slate-900">Webreich</span>
              </p>
              <img src="/brandlogo.png" alt="Webreich" className="h-7 w-auto max-w-[150px] object-contain" loading="lazy" />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default Layout;

