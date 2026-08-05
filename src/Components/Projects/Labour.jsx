import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Edit2, List, MessageCircle, Plus, Search, Trash2, X } from 'lucide-react';
import { db } from '../../Firebase/config';
import FilterBar from '../Common/FilterBar';
import ExportButton from '../Common/ExportButton';
import { getLocalDateTimeInputValue, isDateWithinRange } from '../../utils/dateTime';
import { openWhatsAppMessage } from '../../utils/whatsapp';

const paymentModeOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank-transfer', label: 'Bank Transfer' }
];

const createInitialEntry = () => ({
  contractorName: '',
  modeOfWork: '',
  contactNumber: '',
  paymentMode: '',
  chequeNumber: '',
  chequeName: '',
  bankName: '',
  chequeDate: '',
  amount: '',
  note: '',
  date: getLocalDateTimeInputValue()
});

const initialWorkModeState = {
  name: ''
};

const Labour = () => {
  const { projectId } = useParams();
  const [labourEntries, setLabourEntries] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [workModes, setWorkModes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWorkModeWorkspaceOpen, setIsWorkModeWorkspaceOpen] = useState(false);
  const [isWorkModeModalOpen, setIsWorkModeModalOpen] = useState(false);
  const [draftEntry, setDraftEntry] = useState(createInitialEntry);
  const [draftWorkMode, setDraftWorkMode] = useState(initialWorkModeState);
  const [editingId, setEditingId] = useState(null);
  const [editingWorkModeId, setEditingWorkModeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFiltersOnMobile, setShowFiltersOnMobile] = useState(false);
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [whatsappContext, setWhatsappContext] = useState(null);
  const [whatsappDraft, setWhatsappDraft] = useState({ sendType: 'single', fromDate: '', toDate: '' });

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    contractorName: '',
    modeOfWork: '',
    paymentMode: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [entriesSnapshot, contractorSnapshot, workModeSnapshot] = await Promise.all([
        getDocs(collection(db, `projects/${projectId}/labour`)),
        getDocs(collection(db, 'contractors')),
        getDocs(collection(db, 'modeOfWorks'))
      ]);

      const entries = entriesSnapshot.docs
        .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const contractorList = contractorSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        name: snapshot.data().name
      }));
      const workModeList = workModeSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        name: snapshot.data().name
      }));

      setLabourEntries(entries);
      setContractors(contractorList);
      setWorkModes(workModeList);
    } catch (error) {
      console.error('Error loading labour entries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const openCreateModal = () => {
    setEditingId(null);
    setDraftEntry(createInitialEntry());
    setIsModalOpen(true);
  };

  const saveEntry = async () => {
    if (!draftEntry.contractorName.trim() || !draftEntry.modeOfWork || !draftEntry.amount || !draftEntry.paymentMode) {
      alert('Contractor name, mode of work, amount, and payment mode are required.');
      return;
    }
    if (
      draftEntry.paymentMode === 'cheque' &&
      (!draftEntry.chequeNumber.trim() || !draftEntry.chequeName.trim() || !draftEntry.bankName.trim() || !draftEntry.chequeDate)
    ) {
      alert('Cheque number, cheque name, bank name, and cheque date are required for cheque payment mode.');
      return;
    }

    const payload = {
      ...draftEntry,
      contractorName: draftEntry.contractorName.trim(),
      amount: Number(draftEntry.amount),
      chequeNumber: draftEntry.paymentMode === 'cheque' ? draftEntry.chequeNumber.trim() : '',
      chequeName: draftEntry.paymentMode === 'cheque' ? draftEntry.chequeName.trim() : '',
      bankName: draftEntry.paymentMode === 'cheque' ? draftEntry.bankName.trim() : '',
      chequeDate: draftEntry.paymentMode === 'cheque' ? draftEntry.chequeDate : '',
      createdAt: new Date().toISOString()
    };

    try {
      const alreadyExists = contractors.some((item) => item.name.toLowerCase() === draftEntry.contractorName.toLowerCase());
      if (!alreadyExists) {
        await addDoc(collection(db, 'contractors'), { name: draftEntry.contractorName.trim() });
      }

      if (editingId) {
        await updateDoc(doc(db, `projects/${projectId}/labour`, editingId), payload);
      } else {
        await addDoc(collection(db, `projects/${projectId}/labour`), payload);
      }

      setIsModalOpen(false);
      setDraftEntry(createInitialEntry());
      setEditingId(null);
      loadData();
    } catch (error) {
      console.error('Error saving labour entry:', error);
    }
  };

  const editEntry = (entry) => {
    setDraftEntry({
      contractorName: entry.contractorName,
      modeOfWork: entry.modeOfWork || '',
      contactNumber: entry.contactNumber || '',
      paymentMode: entry.paymentMode || '',
      chequeNumber: entry.chequeNumber || '',
      chequeName: entry.chequeName || '',
      bankName: entry.bankName || '',
      chequeDate: entry.chequeDate || '',
      amount: entry.amount,
      note: entry.note || '',
      date: entry.date
    });
    setEditingId(entry.id);
    setIsModalOpen(true);
  };

  const deleteEntry = async (id) => {
    if (!window.confirm('Delete this labour entry?')) return;

    try {
      await deleteDoc(doc(db, `projects/${projectId}/labour`, id));
      loadData();
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const resetWorkModeState = () => {
    setDraftWorkMode(initialWorkModeState);
    setEditingWorkModeId(null);
  };

  const saveWorkMode = async () => {
    if (!draftWorkMode.name.trim()) {
      alert('Mode of work name is required.');
      return;
    }

    const payload = { name: draftWorkMode.name.trim() };

    try {
      if (editingWorkModeId) {
        await updateDoc(doc(db, 'modeOfWorks', editingWorkModeId), payload);
      } else {
        await addDoc(collection(db, 'modeOfWorks'), payload);
      }

      setIsWorkModeModalOpen(false);
      resetWorkModeState();
      loadData();
    } catch (error) {
      console.error('Error saving mode of work:', error);
    }
  };

  const editWorkMode = (mode) => {
    setDraftWorkMode({ name: mode.name || '' });
    setEditingWorkModeId(mode.id);
    setIsWorkModeModalOpen(true);
  };

  const deleteWorkMode = async (id) => {
    if (!window.confirm('Delete this mode of work?')) return;

    try {
      await deleteDoc(doc(db, 'modeOfWorks', id));
      loadData();
    } catch (error) {
      console.error('Error deleting mode of work:', error);
    }
  };

  const openWhatsappModal = (entry) => {
    const dateKey = String(entry.date || '').slice(0, 10);
    setWhatsappContext(entry);
    setWhatsappDraft({
      sendType: 'single',
      fromDate: dateKey,
      toDate: dateKey
    });
    setIsWhatsappModalOpen(true);
  };

  const sendLabourWhatsapp = () => {
    if (!whatsappContext) return;

    const baseEntries = labourEntries.filter((entry) => entry.contractorName === whatsappContext.contractorName);
    const selectedEntries =
      whatsappDraft.sendType === 'single'
        ? labourEntries.filter((entry) => entry.id === whatsappContext.id)
        : baseEntries.filter((entry) => isDateWithinRange(entry.date, whatsappDraft.fromDate, whatsappDraft.toDate));

    if (!selectedEntries.length) {
      alert('No entries found for selected range.');
      return;
    }

    const phoneNumbers = [...new Set(selectedEntries.map((entry) => entry.contactNumber).filter(Boolean))];

    if (!phoneNumbers.length) {
      alert('No contact number found in selected entries.');
      return;
    }

    const lines = selectedEntries.map((entry, index) => {
      return [
        `${index + 1}. Date: ${new Date(entry.date).toLocaleString('en-IN')}`,
        `Work: ${entry.modeOfWork || '-'}`,
        `Amount: INR ${Number(entry.amount || 0).toLocaleString('en-IN')}`,
        `Mode: ${(entry.paymentMode || '-').replace('-', ' ')}`,
        `Cheque No: ${entry.chequeNumber || '-'}`,
        `Cheque Name: ${entry.chequeName || '-'}`,
        `Bank: ${entry.bankName || '-'}`,
        `Cheque Date: ${entry.chequeDate || '-'}`,
        `Note: ${entry.note || '-'}`
      ].join('\n');
    });

    const totalAmount = selectedEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const message = [
      `Labour Details - ${whatsappContext.contractorName}`,
      whatsappDraft.sendType === 'single'
        ? 'Scope: Single Entry'
        : `Scope: Date Range (${whatsappDraft.fromDate || '-'} to ${whatsappDraft.toDate || '-'})`,
      `Entries: ${selectedEntries.length}`,
      `Total Amount: INR ${totalAmount.toLocaleString('en-IN')}`,
      '',
      ...lines
    ].join('\n');

    let sentCount = 0;
    phoneNumbers.forEach((phone) => {
      if (openWhatsAppMessage(phone, message)) sentCount += 1;
    });

    if (!sentCount) {
      alert('Could not open WhatsApp. Please check contact number format.');
      return;
    }

    setIsWhatsappModalOpen(false);
    setWhatsappContext(null);
  };

  const contractorFilterOptions = useMemo(() => {
    const uniqueNames = [...new Set(labourEntries.map((entry) => entry.contractorName).filter(Boolean))];
    return uniqueNames.sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }));
  }, [labourEntries]);

  const modeOfWorkFilterOptions = useMemo(() => {
    const uniqueModes = [...new Set([...workModes.map((mode) => mode.name), ...labourEntries.map((entry) => entry.modeOfWork)].filter(Boolean))];
    return uniqueModes.sort((a, b) => a.localeCompare(b)).map((mode) => ({ value: mode, label: mode }));
  }, [labourEntries, workModes]);

  const filteredEntries = useMemo(() => {
    return labourEntries.filter((entry) => {
      const entryDate = new Date(entry.date);
      const startDate = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
      const endDate = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;

      if (startDate && entryDate < startDate) return false;
      if (endDate && entryDate > endDate) return false;
      if (filters.contractorName && entry.contractorName !== filters.contractorName) return false;
      if (filters.modeOfWork && entry.modeOfWork !== filters.modeOfWork) return false;
      if (filters.paymentMode && entry.paymentMode !== filters.paymentMode) return false;

      if (searchTerm.trim()) {
        const keyword = searchTerm.toLowerCase();
        return entry.contractorName?.toLowerCase().includes(keyword) || entry.modeOfWork?.toLowerCase().includes(keyword);
      }

      return true;
    });
  }, [labourEntries, filters, searchTerm]);

  const totalAmount = filteredEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="surface-card p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Labour Management</h2>
            <p className="text-sm text-slate-600">Track contractor work, costs, and daily entries.</p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button type="button" onClick={() => setIsWorkModeWorkspaceOpen(true)} className="neutral-btn">
              <List className="h-4 w-4" />
              Mode Master
            </button>
            <button type="button" onClick={openCreateModal} className="orange-btn">
              <Plus className="h-4 w-4" />
              Add Labour Entry
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="input-field pl-9"
                placeholder="Contractor or work type"
              />
            </div>
          </div>

          <div className="xl:hidden">
            <button type="button" onClick={() => setShowFiltersOnMobile((prev) => !prev)} className="neutral-btn w-full">
              {showFiltersOnMobile ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>

          <div className={`${showFiltersOnMobile ? 'block' : 'hidden'} xl:block`}>
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              dropdownKey="contractorName"
              dropdownLabel="Contractor"
              dropdownOptions={contractorFilterOptions}
              extraDropdowns={[
                {
                  key: 'modeOfWork',
                  label: 'Mode of Work',
                  options: modeOfWorkFilterOptions
                },
                {
                  key: 'paymentMode',
                  label: 'Payment Mode',
                  options: paymentModeOptions
                }
              ]}
            />
          </div>

          <div className="flex justify-end">
            <ExportButton data={filteredEntries} filename="labour_report" type="labour" />
          </div>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold text-slate-900">{filteredEntries.length}</span> filtered entries
          </p>
          <p>
            Total labour cost: <span className="font-semibold text-slate-900">INR {totalAmount.toLocaleString('en-IN')}</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Date', 'Contractor', 'Mode of Work', 'Contact', 'Amount', 'Payment Mode', 'Cheque Details', 'Note', 'Actions'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/90">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-blue-50/60">
                  <td className="px-4 py-3 text-sm text-slate-600">{new Date(entry.date).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{entry.contractorName}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{entry.modeOfWork || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{entry.contactNumber || '-'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">INR {Number(entry.amount || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 capitalize">{(entry.paymentMode || '-').replace('-', ' ')}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {entry.paymentMode === 'cheque' ? (
                      <div className="space-y-0.5">
                        <p>No: {entry.chequeNumber || '-'}</p>
                        <p>Name: {entry.chequeName || '-'}</p>
                        <p>Bank: {entry.bankName || '-'}</p>
                        <p>Date: {entry.chequeDate || '-'}</p>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{entry.note || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => editEntry(entry)} className="neutral-btn h-8 w-8 border-slate-200 p-0">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openWhatsappModal(entry)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                        title="Send on WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => deleteEntry(entry.id)} className="neutral-btn h-8 w-8 border-slate-200 p-0 text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filteredEntries.length && <div className="px-4 py-10 text-center text-sm text-slate-500">No labour entries found for selected filters.</div>}
      </section>

      {isWorkModeWorkspaceOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-2 sm:p-4">
          <div className="glass-card h-full w-full overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 md:px-5 md:py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Mode of Work Master</h3>
                <p className="text-sm text-slate-600">Create reusable labour work modes for clean entries and reports.</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetWorkModeState();
                    setIsWorkModeModalOpen(true);
                  }}
                  className="orange-btn"
                >
                  <Plus className="h-4 w-4" />
                  Add Mode
                </button>
                <button type="button" onClick={() => setIsWorkModeWorkspaceOpen(false)} className="neutral-btn">
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>
            </div>

            <div className="h-[calc(100%-84px)] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-sm">
                  <tr>
                    {['Mode of Work', 'Actions'].map((head) => (
                      <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white/90">
                  {[...workModes]
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                    .map((mode) => (
                      <tr key={mode.id} className="hover:bg-blue-50/60">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{mode.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => editWorkMode(mode)} className="neutral-btn h-8 w-8 border-slate-200 p-0">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => deleteWorkMode(mode.id)} className="neutral-btn h-8 w-8 border-slate-200 p-0 text-red-600 hover:bg-red-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {!workModes.length && <div className="px-4 py-10 text-center text-sm text-slate-500">No mode of work records yet. Add your first mode to begin.</div>}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card max-h-[92vh] w-full max-w-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Labour Entry' : 'Add Labour Entry'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="neutral-btn h-9 w-9 border-none p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Date & Time</label>
                <input
                  type="datetime-local"
                  value={draftEntry.date}
                  onChange={(event) => setDraftEntry((prev) => ({ ...prev, date: event.target.value }))}
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Contractor Name</label>
                <input
                  value={draftEntry.contractorName}
                  onChange={(event) => setDraftEntry((prev) => ({ ...prev, contractorName: event.target.value }))}
                  className="input-field"
                  list="contractor-suggestions"
                  placeholder="Type contractor name"
                />
                <datalist id="contractor-suggestions">
                  {contractors.map((contractor) => (
                    <option key={contractor.id} value={contractor.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Mode of Work</label>
                <select
                  value={draftEntry.modeOfWork}
                  onChange={(event) => setDraftEntry((prev) => ({ ...prev, modeOfWork: event.target.value }))}
                  className="input-field"
                >
                  <option value="">Select mode of work</option>
                  {[...workModes]
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                    .map((mode) => (
                      <option key={mode.id} value={mode.name}>
                        {mode.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Contact Number</label>
                <input
                  value={draftEntry.contactNumber}
                  onChange={(event) => setDraftEntry((prev) => ({ ...prev, contactNumber: event.target.value }))}
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Payment Mode</label>
                <select
                  value={draftEntry.paymentMode}
                  onChange={(event) => setDraftEntry((prev) => ({ ...prev, paymentMode: event.target.value }))}
                  className="input-field"
                >
                  <option value="">Select payment mode</option>
                  {paymentModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {draftEntry.paymentMode === 'cheque' && (
                <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Cheque Number</label>
                  <input
                    value={draftEntry.chequeNumber}
                    onChange={(event) => setDraftEntry((prev) => ({ ...prev, chequeNumber: event.target.value }))}
                    className="input-field"
                    placeholder="Enter cheque number"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Cheque Name</label>
                  <input
                    value={draftEntry.chequeName}
                    onChange={(event) => setDraftEntry((prev) => ({ ...prev, chequeName: event.target.value }))}
                    className="input-field"
                    placeholder="Name on cheque"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Bank Name</label>
                  <input
                    value={draftEntry.bankName}
                    onChange={(event) => setDraftEntry((prev) => ({ ...prev, bankName: event.target.value }))}
                    className="input-field"
                    placeholder="Bank name"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Cheque Date</label>
                  <input
                    type="date"
                    value={draftEntry.chequeDate}
                    onChange={(event) => setDraftEntry((prev) => ({ ...prev, chequeDate: event.target.value }))}
                    className="input-field"
                  />
                </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Amount (INR)</label>
                <input
                  type="number"
                  min="0"
                  value={draftEntry.amount}
                  onChange={(event) => setDraftEntry((prev) => ({ ...prev, amount: event.target.value }))}
                  className="input-field font-semibold"
                  placeholder="0.00"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Note</label>
                <textarea
                  value={draftEntry.note}
                  onChange={(event) => setDraftEntry((prev) => ({ ...prev, note: event.target.value }))}
                  className="input-field min-h-24"
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="neutral-btn">
                Cancel
              </button>
              <button type="button" onClick={saveEntry} className="orange-btn">
                {editingId ? 'Update Entry' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isWorkModeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-md">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{editingWorkModeId ? 'Edit Mode of Work' : 'Add Mode of Work'}</h2>
              <button type="button" onClick={() => setIsWorkModeModalOpen(false)} className="neutral-btn h-9 w-9 border-none p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Mode of Work</label>
                <input
                  value={draftWorkMode.name}
                  onChange={(event) => setDraftWorkMode((prev) => ({ ...prev, name: event.target.value }))}
                  className="input-field"
                  placeholder="Mason / Painter / Electrician"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={() => setIsWorkModeModalOpen(false)} className="neutral-btn">
                Cancel
              </button>
              <button type="button" onClick={saveWorkMode} className="orange-btn">
                {editingWorkModeId ? 'Update Mode' : 'Add Mode'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isWhatsappModalOpen && whatsappContext && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Send Labour Details on WhatsApp</h3>
              <button type="button" onClick={() => setIsWhatsappModalOpen(false)} className="neutral-btn h-9 w-9 border-none p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Contractor: <span className="font-semibold text-slate-900">{whatsappContext.contractorName}</span>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Send Type</label>
                <select
                  value={whatsappDraft.sendType}
                  onChange={(event) => setWhatsappDraft((prev) => ({ ...prev, sendType: event.target.value }))}
                  className="input-field"
                >
                  <option value="single">Only this selected entry</option>
                  <option value="datewise">Date-wise entries for this contractor</option>
                </select>
              </div>

              {whatsappDraft.sendType === 'datewise' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">From Date</label>
                    <input
                      type="date"
                      value={whatsappDraft.fromDate}
                      onChange={(event) => setWhatsappDraft((prev) => ({ ...prev, fromDate: event.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">To Date</label>
                    <input
                      type="date"
                      value={whatsappDraft.toDate}
                      onChange={(event) => setWhatsappDraft((prev) => ({ ...prev, toDate: event.target.value }))}
                      className="input-field"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={() => setIsWhatsappModalOpen(false)} className="neutral-btn">
                Cancel
              </button>
              <button type="button" onClick={sendLabourWhatsapp} className="orange-btn">
                <MessageCircle className="h-4 w-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Labour;


