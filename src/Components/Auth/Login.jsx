import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { LogIn } from 'lucide-react';
import { auth } from '../../Firebase/config';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (submissionError) {
      console.error(submissionError);
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-4">
      <div className="glass-card w-full max-w-md overflow-hidden">
        <div className="border-b border-zinc-200 bg-slate-950 px-6 py-8 text-center text-white">
          <img
            src="/logo.png"
            alt="Vastushobha Construction"
            loading="eager"
            decoding="async"
            className="mx-auto h-24 w-auto max-w-[260px] rounded-xl border border-slate-700 bg-white px-4 py-3 object-contain shadow-sm"
          />
          <h1 className="mt-4 text-2xl font-semibold">Vastushobha Construction</h1>
          <p className="mt-1 text-sm text-zinc-300">Secure admin login</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Email Address</label>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input-field" required />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Password</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input-field" required />
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          <button type="submit" disabled={loading} className="orange-btn w-full">
            <LogIn className="h-4 w-4" />
            {loading ? 'Signing in...' : 'Login'}
          </button>

          <p className="text-center text-sm text-zinc-600">
            New admin?{' '}
            <button type="button" onClick={() => navigate('/create-admin')} className="font-semibold text-blue-700 hover:text-blue-800">
              Create account
            </button>
          </p>
        </form>


      </div>

      <footer className="mt-2 w-full max-w-md px-2 pb-3">
        <a
          href="https://www.webreich.in"
          target="_blank"
          rel="noopener noreferrer"
          className="glass-card flex flex-col items-center justify-between gap-3 px-4 py-3 text-xs text-slate-600 transition hover:border-blue-300 sm:flex-row"
        >
          <p>
            Powered by <span className="font-semibold text-slate-900">Webreich</span>
          </p>
          <img src="/brandlogo.png" alt="Webreich" className="h-7 w-auto max-w-[150px] object-contain" loading="lazy" />
        </a>
      </footer>
    </div>
  );
};

export default Login;



