import React, { useState } from 'react';
import { X } from 'lucide-react';

const CreateProjectModal = ({ isOpen, onClose, onCreate }) => {
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [siteType, setSiteType] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!projectName.trim() || !clientName.trim() || !siteType) return;
    onCreate({
      projectName: projectName.trim(),
      clientName: clientName.trim(),
      siteType
    });
    setProjectName('');
    setClientName('');
    setSiteType('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="glass-card w-full max-w-md">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Create New Project</h2>
          <button type="button" onClick={onClose} className="neutral-btn h-9 w-9 border-none p-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              className="input-field"
              placeholder="Example: Riverside Apartments"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Client Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              className="input-field"
              placeholder="Example: Shree Infra Developers"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Site Type</label>
            <select
              value={siteType}
              onChange={(event) => setSiteType(event.target.value)}
              className="input-field"
              required
            >
              <option value="">Select site type</option>
              <option value="supervision">Supervision</option>
              <option value="with-material">With Material</option>
              <option value="interior">Interior</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="neutral-btn">
              Cancel
            </button>
            <button type="submit" className="orange-btn">
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;


