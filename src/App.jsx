import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
// import { onAuthStateChanged } from 'firebase/auth';
// import { auth } from './Firebase/config';
import Login from './Components/Auth/Login';
import CreateAdmin from './Components/Auth/CreateAdmin';
import Layout from './Components/Layout/Layout';
import Dashboard from './Components/Dashboard/Dashboard';
import ProjectDetails from './Components/Projects/ProjectDetails';
import Materials from './Components/Projects/Materials';
import Labour from './Components/Projects/Labour';
import Payments from './Components/Projects/Payments';
import Reports from './Components/Projects/Reports';
import Expenses from './Components/Projects/Expenses';

function App() {
  // Temporary auth bypass for direct app access.
  // Set this to false when you want login/auth back.
  const AUTH_BYPASS = true;
  const user = AUTH_BYPASS ? { displayName: 'Admin', email: 'admin@local.dev' } : null;

  // Auth listener temporarily disabled.
  // useEffect(() => {
  //   const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
  //     setUser(currentUser);
  //     setLoading(false);
  //   });

  //   return () => unsubscribe();
  // }, []);

  // Loading state disabled while auth is bypassed.
  // if (loading) {
  //   return (
  //     <div className="flex min-h-screen items-center justify-center px-4">
  //       <div className="glass-card p-8 text-center">
  //         <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-700" />
  //         <p className="mt-4 text-sm font-medium text-zinc-700">Preparing your workspace...</p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={AUTH_BYPASS ? <Navigate to="/" replace /> : !user ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/create-admin" element={AUTH_BYPASS ? <Navigate to="/" replace /> : !user ? <CreateAdmin /> : <Navigate to="/" replace />} />

        <Route path="/" element={AUTH_BYPASS || user ? <Layout user={user} /> : <Navigate to="/login" replace />}>
          <Route index element={<Dashboard user={user} />} />
          <Route path="expenses" element={<Expenses />} />

          <Route path="project/:projectId" element={<ProjectDetails />}>
            <Route index element={<Navigate to="materials" replace />} />
            <Route path="materials" element={<Materials />} />
            <Route path="labour" element={<Labour />} />
            <Route path="payments" element={<Payments />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={AUTH_BYPASS || user ? '/' : '/login'} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
