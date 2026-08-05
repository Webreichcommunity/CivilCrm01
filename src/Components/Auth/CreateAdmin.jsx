import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { UserPlus } from 'lucide-react';
import { auth } from '../../Firebase/config';

const CreateAdmin = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name.trim() });

      setSuccess('Admin account created successfully. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1400);
    } catch (submissionError) {
      console.error(submissionError);
      if (submissionError.code === 'auth/email-already-in-use') {
        setError('Email already in use.');
      } else if (submissionError.code === 'auth/invalid-email') {
        setError('Please enter a valid email.');
      } else {
        setError('Unable to create admin account right now.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="glass-card w-full max-w-md overflow-hidden">
        <div className="border-b border-zinc-200 bg-slate-950 px-6 py-8 text-center text-white">
          <img src="/brandlogo.png" alt="Webreich" loading="eager" decoding="async" className="mx-auto h-16 w-16 rounded-2xl border border-slate-700 bg-white p-1 object-contain" />
          <h1 className="mt-4 text-2xl font-semibold">Create Admin</h1>
          <p className="mt-1 text-sm text-zinc-300">Set up secure access for Vastushobha Construction</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Full Name</label>
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} className="input-field" required />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Email Address</label>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input-field" required />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Password</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input-field" required />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="input-field" required />
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}

          <button type="submit" disabled={loading} className="orange-btn w-full">
            <UserPlus className="h-4 w-4" />
            {loading ? 'Creating...' : 'Create Admin Account'}
          </button>

          <p className="text-center text-sm text-zinc-600">
            Already have account?{' '}
            <button type="button" onClick={() => navigate('/login')} className="font-semibold text-blue-700 hover:text-blue-800">
              Login
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

export default CreateAdmin;



