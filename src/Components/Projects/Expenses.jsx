import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Edit2, Plus, ReceiptText, Search, Trash2, X } from 'lucide-react';
import { db } from '../../Firebase/config';
import FilterBar from '../Common/FilterBar';
import ExportButton from '../Common/ExportButton';
import { getLocalDateTimeInputValue } from '../../utils/dateTime';

const paymentModeOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank-transfer', label: 'Bank Transfer' }
];

const payeeTypeOptions = [
  { value: 'vendor', label: 'Vendor' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'staff', label: 'Staff' },
  { value: 'other', label: 'Other' }
];

const createEmptyAllocation = () => ({
  projectId: '',
  projectName: '',
  amount: '',
  paymentMode: '',
  chequeNumber: '',
  chequeName: '',
  bankName: '',
  chequeDate: ''
});

const createInitialExpense = () => ({
  dateTime: getLocalDateTimeInputValue(),
  payeeType: 'vendor',
  payeeName: '',
  expenseTitle: '',
  amount: '',
  paymentMode: '',
  chequeNumber: '',
  chequeName: '',
  bankName: '',
  chequeDate: '',
  note: '',
  allocationMode: 'single',
  selectedProjectId: '',
  selectedProjectName: '',
  allocations: [createEmptyAllocation()]
});

const Expenses = () => {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftExpense, setDraftExpense] = useState(createInitialExpense);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFiltersOnMobile, setShowFiltersOnMobile] = useState(false);

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    payeeType: '',
    paymentMode: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'expenses'));
      const entries = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
      setExpenses(entries);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'projects'));
      const list = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      setProjects(list);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    loadProjects();
  }, []);

  const openCreateModal = () => {
    setDraftExpense(createInitialExpense());
    setEditingId(null);
    setIsModalOpen(true);
  };

  const isChequeDetailsMissing = (entry) =>
    !entry.chequeNumber?.trim() || !entry.chequeName?.trim() || !entry.bankName?.trim() || !entry.chequeDate;

  const saveExpense = async () => {
    if (!draftExpense.dateTime || !draftExpense.payeeName.trim() || !draftExpense.expenseTitle.trim() || !draftExpense.amount) {
      alert('Date, payee, expense title, and amount are required.');
      return;
    }

    const amountValue = Number(draftExpense.amount);
    const normalizedAllocations = (draftExpense.allocationMode === 'multiple' ? draftExpense.allocations : [])
      .filter((entry) => entry.projectId && Number(entry.amount || 0) > 0)
      .map((entry) => ({
        projectId: entry.projectId,
        projectName: entry.projectName || projects.find((project) => project.id === entry.projectId)?.name || 'Unknown site',
        amount: Number(entry.amount || 0),
        paymentMode: entry.paymentMode,
        chequeNumber: entry.paymentMode === 'cheque' ? entry.chequeNumber.trim() : '',
        chequeName: entry.paymentMode === 'cheque' ? entry.chequeName.trim() : '',
        bankName: entry.paymentMode === 'cheque' ? entry.bankName.trim() : '',
        chequeDate: entry.paymentMode === 'cheque' ? entry.chequeDate : ''
      }));

    if (draftExpense.allocationMode === 'single') {
      if (!draftExpense.selectedProjectId) {
        alert('Please select the site or project for this expense.');
        return;
      }
      if (!draftExpense.paymentMode) {
        alert('Please choose a payment mode.');
        return;
      }
      if (draftExpense.paymentMode === 'cheque' && isChequeDetailsMissing(draftExpense)) {
        alert('Cheque number, cheque name, bank name, and cheque date are required for cheque payments.');
        return;
      }
    } else {
      if (!normalizedAllocations.length) {
        alert('Please add at least one site allocation.');
        return;
      }
      const totalAllocated = normalizedAllocations.reduce((sum, entry) => sum + entry.amount, 0);
      if (Math.abs(totalAllocated - amountValue) > 0.01) {
        alert('The distributed amount must exactly match the expense amount.');
        return;
      }
      const missingPaymentMode = normalizedAllocations.some((entry) => !entry.paymentMode);
      if (missingPaymentMode) {
        alert('Please choose a payment mode for each site allocation.');
        return;
      }
      const missingChequeDetails = normalizedAllocations.some((entry) => entry.paymentMode === 'cheque' && isChequeDetailsMissing(entry));
      if (missingChequeDetails) {
        alert('Cheque number, cheque name, bank name, and cheque date are required for each cheque allocation.');
        return;
      }
    }

    const payload = {
      ...draftExpense,
      payeeName: draftExpense.payeeName.trim(),
      expenseTitle: draftExpense.expenseTitle.trim(),
      amount: amountValue,
      paymentMode: draftExpense.allocationMode === 'single' ? draftExpense.paymentMode : '',
      chequeNumber: draftExpense.allocationMode === 'single' && draftExpense.paymentMode === 'cheque' ? draftExpense.chequeNumber.trim() : '',
      chequeName: draftExpense.allocationMode === 'single' && draftExpense.paymentMode === 'cheque' ? draftExpense.chequeName.trim() : '',
      bankName: draftExpense.allocationMode === 'single' && draftExpense.paymentMode === 'cheque' ? draftExpense.bankName.trim() : '',
      chequeDate: draftExpense.allocationMode === 'single' && draftExpense.paymentMode === 'cheque' ? draftExpense.chequeDate : '',
      allocationMode: draftExpense.allocationMode,
      selectedProjectId: draftExpense.allocationMode === 'single' ? draftExpense.selectedProjectId : '',
      selectedProjectName: draftExpense.allocationMode === 'single' ? draftExpense.selectedProjectName : '',
      allocations: draftExpense.allocationMode === 'single'
        ? [{
          projectId: draftExpense.selectedProjectId,
          projectName: draftExpense.selectedProjectName || 'Unknown site',
          amount: amountValue,
          paymentMode: draftExpense.paymentMode,
          chequeNumber: draftExpense.paymentMode === 'cheque' ? draftExpense.chequeNumber.trim() : '',
          chequeName: draftExpense.paymentMode === 'cheque' ? draftExpense.chequeName.trim() : '',
          bankName: draftExpense.paymentMode === 'cheque' ? draftExpense.bankName.trim() : '',
          chequeDate: draftExpense.paymentMode === 'cheque' ? draftExpense.chequeDate : ''
        }]
        : normalizedAllocations,
      createdAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'expenses', editingId), payload);
      } else {
        await addDoc(collection(db, 'expenses'), payload);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setDraftExpense(createInitialExpense());
      loadData();
    } catch (error) {
      console.error('Error saving expense:', error);
    }
  };

  const editExpense = (entry) => {
    setDraftExpense({
      dateTime: entry.dateTime || getLocalDateTimeInputValue(),
      payeeType: entry.payeeType || 'vendor',
      payeeName: entry.payeeName || '',
      expenseTitle: entry.expenseTitle || '',
      amount: entry.amount || '',
      paymentMode: entry.paymentMode || '',
      chequeNumber: entry.chequeNumber || '',
      chequeName: entry.chequeName || '',
      bankName: entry.bankName || '',
      chequeDate: entry.chequeDate || '',
      note: entry.note || '',
      allocationMode: entry.allocationMode || 'single',
      selectedProjectId: entry.selectedProjectId || '',
      selectedProjectName: entry.selectedProjectName || '',
      allocations: entry.allocations?.length
        ? entry.allocations.map((allocation) => ({ ...createEmptyAllocation(), ...allocation }))
        : [createEmptyAllocation()]
    });
    setEditingId(entry.id);
    setIsModalOpen(true);
  };

  const deleteExpense = async (id) => {
    if (!window.confirm('Delete this expense entry?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      loadData();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((entry) => {
      const entryDate = new Date(entry.dateTime);
      const startDate = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
      const endDate = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;

      if (startDate && entryDate < startDate) return false;
      if (endDate && entryDate > endDate) return false;
      if (filters.payeeType && entry.payeeType !== filters.payeeType) return false;
      if (filters.paymentMode) {
        const allocationHasMode = entry.allocations?.some((allocation) => allocation.paymentMode === filters.paymentMode);
        if (entry.paymentMode !== filters.paymentMode && !allocationHasMode) return false;
      }

      if (!searchTerm.trim()) return true;
      const keyword = searchTerm.toLowerCase();
      return (
        entry.payeeName?.toLowerCase().includes(keyword) ||
        entry.expenseTitle?.toLowerCase().includes(keyword) ||
        entry.note?.toLowerCase().includes(keyword) ||
        entry.chequeNumber?.toLowerCase().includes(keyword) ||
        entry.chequeName?.toLowerCase().includes(keyword) ||
        entry.bankName?.toLowerCase().includes(keyword) ||
        entry.allocations?.some((allocation) =>
          allocation.projectName?.toLowerCase().includes(keyword) ||
          allocation.paymentMode?.toLowerCase().includes(keyword) ||
          allocation.chequeNumber?.toLowerCase().includes(keyword) ||
          allocation.chequeName?.toLowerCase().includes(keyword) ||
          allocation.bankName?.toLowerCase().includes(keyword)
        )
      );
    });
  }, [expenses, filters, searchTerm]);

  const totalAmount = filteredExpenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const paymentModeLabel = (value) => (value || '-').replace('-', ' ');

  const paymentModeSummary = (entry) => {
    if (entry.allocationMode === 'multiple' && entry.allocations?.length) {
      return entry.allocations
        .map((allocation) => `${allocation.projectName || 'Site'}: ${paymentModeLabel(allocation.paymentMode)}`)
        .join(' | ');
    }
    return paymentModeLabel(entry.paymentMode);
  };

  const chequeSummary = (entry) => {
    const chequeEntries = entry.allocationMode === 'multiple'
      ? (entry.allocations || [])
        .filter((allocation) => allocation.paymentMode === 'cheque')
        .map((allocation) => ({
          title: allocation.projectName || 'Site',
          chequeNumber: allocation.chequeNumber,
          chequeName: allocation.chequeName,
          bankName: allocation.bankName,
          chequeDate: allocation.chequeDate
        }))
      : entry.paymentMode === 'cheque'
        ? [{
          title: 'Main payment',
          chequeNumber: entry.chequeNumber,
          chequeName: entry.chequeName,
          bankName: entry.bankName,
          chequeDate: entry.chequeDate
        }]
        : [];

    if (!chequeEntries.length) return '-';

    return (
      <div className="space-y-2">
        {chequeEntries.map((cheque, index) => (
          <div key={`${cheque.title}-${index}`} className="space-y-0.5">
            <p className="font-medium text-slate-900">{cheque.title}</p>
            <p>No: {cheque.chequeNumber || '-'}</p>
            <p>Name: {cheque.chequeName || '-'}</p>
            <p>Bank: {cheque.bankName || '-'}</p>
            <p>Date: {cheque.chequeDate || '-'}</p>
          </div>
        ))}
      </div>
    );
  };

  const updateAllocation = (index, field, value) => {
    setDraftExpense((prev) => ({
      ...prev,
      allocations: prev.allocations.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        if (field === 'project') {
          const project = projects.find((item) => item.id === value);
          return { ...entry, projectId: value, projectName: project?.name || '' };
        }
        if (field === 'paymentMode' && value !== 'cheque') {
          return { ...entry, paymentMode: value, chequeNumber: '', chequeName: '', bankName: '', chequeDate: '' };
        }
        return { ...entry, [field]: value };
      })
    }));
  };

  const addAllocation = () => {
    setDraftExpense((prev) => ({ ...prev, allocations: [...prev.allocations, createEmptyAllocation()] }));
  };

  const removeAllocation = (index) => {
    setDraftExpense((prev) => ({
      ...prev,
      allocations: prev.allocations.filter((_, entryIndex) => entryIndex !== index)
    }));
  };

  const allocationSummary = (entry) => {
    if (entry.allocationMode === 'multiple' && entry.allocations?.length) {
      return entry.allocations.map((item) => {
        const paymentMode = item.paymentMode ? ` | ${item.paymentMode.replace('-', ' ')}` : '';
        const cheque = item.paymentMode === 'cheque' ? ` | Cheque: ${item.chequeNumber || '-'} / ${item.bankName || '-'}` : '';
        return `${item.projectName || 'Unknown site'}: INR ${Number(item.amount || 0).toLocaleString('en-IN')}${paymentMode}${cheque}`;
      }).join(' | ');
    }
    return entry.selectedProjectName || 'No site selected';
  };

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
            <h2 className="text-xl font-semibold text-slate-900">Other Expenses</h2>
            <p className="text-sm text-slate-600">Record office-wide vendor, contractor, staff, or other bulk expense payments.</p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button type="button" onClick={() => navigate('/')} className="neutral-btn">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>
            <button type="button" onClick={openCreateModal} className="orange-btn">
              <Plus className="h-4 w-4" />
              Add Expense
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
                placeholder="Payee, expense, cheque, bank"
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
              dropdownKey="payeeType"
              dropdownLabel="Payee Type"
              dropdownOptions={payeeTypeOptions}
              extraDropdowns={[
                {
                  key: 'paymentMode',
                  label: 'Payment Mode',
                  options: paymentModeOptions
                }
              ]}
            />
          </div>

          <div className="flex justify-end">
            <ExportButton data={filteredExpenses} filename="other_expenses_report" type="expense" />
          </div>
        </div>
      </section>

      <section className="surface-card border-l-4 border-l-blue-600 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Total Other Expenses</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">INR {totalAmount.toLocaleString('en-IN')}</p>
        <ReceiptText className="mt-3 h-5 w-5 text-blue-700" />
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{filteredExpenses.length}</span> filtered entries
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Date & Time', 'Payee', 'Expense', 'Amount', 'Mode', 'Site Allocation', 'Cheque Details', 'Note', 'Actions'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/90">
              {filteredExpenses.map((entry) => (
                <tr key={entry.id} className="hover:bg-blue-50/60">
                  <td className="px-4 py-3 text-sm text-slate-600">{new Date(entry.dateTime).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">{entry.payeeName || '-'}</p>
                    <p className="capitalize">{entry.payeeType || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{entry.expenseTitle || '-'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">INR {Number(entry.amount || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 capitalize">{paymentModeSummary(entry)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">{entry.allocationMode === 'multiple' ? 'Split across sites' : 'Single site'}</p>
                    <p className="mt-1 text-xs text-slate-500">{allocationSummary(entry)}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {chequeSummary(entry)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{entry.note || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => editExpense(entry)} className="neutral-btn h-8 w-8 border-slate-200 p-0">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => deleteExpense(entry.id)} className="neutral-btn h-8 w-8 border-slate-200 p-0 text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filteredExpenses.length && <div className="px-4 py-10 text-center text-sm text-slate-500">No expense entries found for selected filters.</div>}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-2 sm:p-4">
          <div className="glass-card flex h-full w-full flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Expense' : 'Add Expense'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="neutral-btn h-9 w-9 border-none p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Date & Time</label>
                <input
                  type="datetime-local"
                  value={draftExpense.dateTime}
                  onChange={(event) => setDraftExpense((prev) => ({ ...prev, dateTime: event.target.value }))}
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Payee Type</label>
                <select
                  value={draftExpense.payeeType}
                  onChange={(event) => setDraftExpense((prev) => ({ ...prev, payeeType: event.target.value }))}
                  className="input-field"
                >
                  {payeeTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Payee / Vendor Name</label>
                <input
                  value={draftExpense.payeeName}
                  onChange={(event) => setDraftExpense((prev) => ({ ...prev, payeeName: event.target.value }))}
                  className="input-field"
                  placeholder="Vendor or person name"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Expense Title</label>
                <input
                  value={draftExpense.expenseTitle}
                  onChange={(event) => setDraftExpense((prev) => ({ ...prev, expenseTitle: event.target.value }))}
                  className="input-field"
                  placeholder="Bulk vendor payment / Site expense"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Amount (INR)</label>
                <input
                  type="number"
                  min="0"
                  value={draftExpense.amount}
                  onChange={(event) => setDraftExpense((prev) => ({ ...prev, amount: event.target.value }))}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>

              {draftExpense.allocationMode === 'single' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Payment Mode</label>
                  <select
                    value={draftExpense.paymentMode}
                    onChange={(event) => setDraftExpense((prev) => ({ ...prev, paymentMode: event.target.value }))}
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
              )}

              {draftExpense.allocationMode === 'single' && draftExpense.paymentMode === 'cheque' && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Cheque Number</label>
                    <input
                      value={draftExpense.chequeNumber}
                      onChange={(event) => setDraftExpense((prev) => ({ ...prev, chequeNumber: event.target.value }))}
                      className="input-field"
                      placeholder="Enter cheque number"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Cheque Name</label>
                    <input
                      value={draftExpense.chequeName}
                      onChange={(event) => setDraftExpense((prev) => ({ ...prev, chequeName: event.target.value }))}
                      className="input-field"
                      placeholder="Name on cheque"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Bank Name</label>
                    <input
                      value={draftExpense.bankName}
                      onChange={(event) => setDraftExpense((prev) => ({ ...prev, bankName: event.target.value }))}
                      className="input-field"
                      placeholder="Bank name"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Cheque Date</label>
                    <input
                      type="date"
                      value={draftExpense.chequeDate}
                      onChange={(event) => setDraftExpense((prev) => ({ ...prev, chequeDate: event.target.value }))}
                      className="input-field"
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2 xl:col-span-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">Site / Project Allocation</label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        checked={draftExpense.allocationMode === 'single'}
                        onChange={() => setDraftExpense((prev) => ({ ...prev, allocationMode: 'single', allocations: [createEmptyAllocation()] }))}
                      />
                      Assign to one site
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        checked={draftExpense.allocationMode === 'multiple'}
                        onChange={() => setDraftExpense((prev) => ({
                          ...prev,
                          allocationMode: 'multiple',
                          paymentMode: '',
                          chequeNumber: '',
                          chequeName: '',
                          bankName: '',
                          chequeDate: '',
                          allocations: prev.allocations.length ? prev.allocations : [createEmptyAllocation()]
                        }))}
                      />
                      Split across multiple sites
                    </label>
                  </div>

                  {draftExpense.allocationMode === 'single' ? (
                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Choose site</label>
                      <select
                        value={draftExpense.selectedProjectId}
                        onChange={(event) => setDraftExpense((prev) => ({
                          ...prev,
                          selectedProjectId: event.target.value,
                          selectedProjectName: projects.find((project) => project.id === event.target.value)?.name || ''
                        }))}
                        className="input-field"
                      >
                        <option value="">Select a site</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                      </select>
                      <p className="mt-2 text-sm text-slate-500">This expense will be recorded against the selected site only.</p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700">Distribution across sites</p>
                        <button type="button" onClick={addAllocation} className="neutral-btn h-8 px-3 py-1 text-xs">
                          + Add site
                        </button>
                      </div>

                      {draftExpense.allocations.map((allocation, index) => (
                        <div key={`${allocation.projectId || 'new'}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_0.6fr_0.8fr_auto]">
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Site</label>
                              <select
                                value={allocation.projectId}
                                onChange={(event) => updateAllocation(index, 'project', event.target.value)}
                                className="input-field"
                              >
                                <option value="">Select site</option>
                                {projects.map((project) => (
                                  <option key={project.id} value={project.id}>{project.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</label>
                              <input
                                type="number"
                                min="0"
                                value={allocation.amount}
                                onChange={(event) => updateAllocation(index, 'amount', event.target.value)}
                                className="input-field"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Site payment mode</label>
                              <select
                                value={allocation.paymentMode}
                                onChange={(event) => updateAllocation(index, 'paymentMode', event.target.value)}
                                className="input-field"
                              >
                                <option value="">Select payment mode</option>
                                {paymentModeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-end">
                              <button type="button" onClick={() => removeAllocation(index)} className="neutral-btn h-10 px-3 text-xs">
                                Remove
                              </button>
                            </div>
                          </div>

                          {allocation.paymentMode === 'cheque' && (
                            <div className="mt-3 grid gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 md:grid-cols-2 xl:grid-cols-4">
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Number</label>
                                <input
                                  value={allocation.chequeNumber}
                                  onChange={(event) => updateAllocation(index, 'chequeNumber', event.target.value)}
                                  className="input-field"
                                  placeholder="Enter cheque number"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Name</label>
                                <input
                                  value={allocation.chequeName}
                                  onChange={(event) => updateAllocation(index, 'chequeName', event.target.value)}
                                  className="input-field"
                                  placeholder="Name on cheque"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Bank Name</label>
                                <input
                                  value={allocation.bankName}
                                  onChange={(event) => updateAllocation(index, 'bankName', event.target.value)}
                                  className="input-field"
                                  placeholder="Bank name"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Date</label>
                                <input
                                  type="date"
                                  value={allocation.chequeDate}
                                  onChange={(event) => updateAllocation(index, 'chequeDate', event.target.value)}
                                  className="input-field"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">Allocation guide</p>
                        <p className="mt-1">If you enter 10,000 and split it across 2 sites, the total of both site amounts must equal 10,000.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 xl:col-span-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">Note</label>
                <textarea
                  value={draftExpense.note}
                  onChange={(event) => setDraftExpense((prev) => ({ ...prev, note: event.target.value }))}
                  className="input-field min-h-24"
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white/85 px-5 py-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="neutral-btn">
                Cancel
              </button>
              <button type="button" onClick={saveExpense} className="orange-btn">
                {editingId ? 'Update Expense' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
