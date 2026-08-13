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
  chequeDate: '',
  chequeIssuedTo: '',
  sourcePaymentId: '',
  sourceChequeProjectId: ''
});

const createEmptyPayee = () => ({
  payeeType: 'vendor',
  payeeName: '',
  expenseTitle: '',
  amount: '',
  paymentMode: '',
  chequeNumber: '',
  chequeName: '',
  bankName: '',
  chequeDate: '',
  chequeIssuedTo: '',
  sourcePaymentId: '',
  sourceChequeProjectId: '',
  note: ''
});

const createInitialExpense = () => ({
  dateTime: getLocalDateTimeInputValue(),
  payeeMode: 'single',
  payeeType: 'vendor',
  payeeName: '',
  expenseTitle: '',
  amount: '',
  paymentMode: '',
  chequeNumber: '',
  chequeName: '',
  bankName: '',
  chequeDate: '',
  chequeIssuedTo: '',
  sourcePaymentId: '',
  sourceChequeProjectId: '',
  note: '',
  allocationMode: 'single',
  selectedProjectId: '',
  selectedProjectName: '',
  allocations: [createEmptyAllocation()],
  payees: [createEmptyPayee()]
});

const Expenses = () => {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clientCheques, setClientCheques] = useState([]);
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
      const [expenseSnapshot, projectSnapshot] = await Promise.all([
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'projects'))
      ]);

      const entries = expenseSnapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

      const projectList = projectSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      const chequeGroups = await Promise.all(
        projectList.map(async (project) => {
          const paymentSnapshot = await getDocs(collection(db, `projects/${project.id}/payments`));
          return paymentSnapshot.docs
            .map((payment) => ({ id: payment.id, projectId: project.id, projectName: project.name || 'Unknown site', ...payment.data() }))
            .filter((payment) => payment.paymentType === 'in' && payment.paymentMode === 'cheque' && payment.chequeNumber);
        })
      );

      setExpenses(entries);
      setProjects(projectList);
      setClientCheques(chequeGroups.flat());
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const openCreateModal = () => {
    setDraftExpense(createInitialExpense());
    setEditingId(null);
    setIsModalOpen(true);
  };

  const paymentModeLabel = (value) => (value || '-').replace('-', ' ');
  const formatAmount = (value) => `INR ${Number(value || 0).toLocaleString('en-IN')}`;

  const chequeOptionsForProject = (projectId) =>
    clientCheques.filter((cheque) => !projectId || cheque.projectId === projectId);

  const findClientCheque = (projectId, chequeNumber) => {
    const cleaned = String(chequeNumber || '').trim().toLowerCase();
    if (!cleaned) return null;
    return chequeOptionsForProject(projectId).find((cheque) => String(cheque.chequeNumber || '').trim().toLowerCase() === cleaned) || null;
  };

  const hydrateChequeDetails = (entry, cheque, chequeNumber = entry.chequeNumber) => {
    if (!cheque) {
      return { ...entry, chequeNumber, sourcePaymentId: '', sourceChequeProjectId: '' };
    }

    return {
      ...entry,
      chequeNumber: cheque.chequeNumber || chequeNumber,
      chequeName: cheque.chequeName || entry.chequeName || '',
      bankName: cheque.bankName || entry.bankName || '',
      chequeDate: cheque.chequeDate || entry.chequeDate || '',
      sourcePaymentId: cheque.id,
      sourceChequeProjectId: cheque.projectId
    };
  };

  const isChequeDetailsMissing = (entry) =>
    !entry.chequeNumber?.trim() ||
    !entry.chequeName?.trim() ||
    !entry.bankName?.trim() ||
    !entry.chequeDate ||
    !entry.chequeIssuedTo?.trim();

  const normalizeChequeFields = (entry) => ({
    chequeNumber: entry.paymentMode === 'cheque' ? entry.chequeNumber.trim() : '',
    chequeName: entry.paymentMode === 'cheque' ? entry.chequeName.trim() : '',
    bankName: entry.paymentMode === 'cheque' ? entry.bankName.trim() : '',
    chequeDate: entry.paymentMode === 'cheque' ? entry.chequeDate : '',
    chequeIssuedTo: entry.paymentMode === 'cheque' ? entry.chequeIssuedTo.trim() : '',
    sourcePaymentId: entry.paymentMode === 'cheque' ? entry.sourcePaymentId || '' : '',
    sourceChequeProjectId: entry.paymentMode === 'cheque' ? entry.sourceChequeProjectId || '' : ''
  });

  const saveExpense = async () => {
    if (!draftExpense.dateTime || !draftExpense.expenseTitle.trim() || !draftExpense.amount) {
      alert('Date, expense title, and amount are required.');
      return;
    }

    const amountValue = Number(draftExpense.amount);
    if (amountValue <= 0) {
      alert('Amount must be greater than zero.');
      return;
    }

    if (draftExpense.payeeMode === 'multiple') {
      if (!draftExpense.selectedProjectId) {
        alert('Please select the site paying these vendors.');
        return;
      }

      const normalizedPayees = draftExpense.payees
        .filter((payee) => payee.payeeName.trim() || Number(payee.amount || 0) > 0)
        .map((payee) => ({
          ...payee,
          payeeName: payee.payeeName.trim(),
          expenseTitle: payee.expenseTitle.trim() || draftExpense.expenseTitle.trim(),
          amount: Number(payee.amount || 0),
          note: payee.note?.trim() || '',
          ...normalizeChequeFields(payee)
        }));

      if (!normalizedPayees.length) {
        alert('Please add at least one vendor or contractor.');
        return;
      }
      if (normalizedPayees.some((payee) => !payee.payeeName || !payee.amount || !payee.paymentMode)) {
        alert('Every payee needs a name, amount, and payment mode.');
        return;
      }
      if (Math.abs(normalizedPayees.reduce((sum, payee) => sum + payee.amount, 0) - amountValue) > 0.01) {
        alert('The total of all vendor payments must exactly match the expense amount.');
        return;
      }
      if (normalizedPayees.some((payee) => payee.paymentMode === 'cheque' && isChequeDetailsMissing(payee))) {
        alert('Cheque number, cheque name, bank name, cheque date, and cheque given to are required for cheque payments.');
        return;
      }

      const payload = {
        dateTime: draftExpense.dateTime,
        payeeMode: 'multiple',
        payeeType: 'multiple',
        payeeName: 'Multiple Payees',
        expenseTitle: draftExpense.expenseTitle.trim(),
        amount: amountValue,
        paymentMode: '',
        chequeNumber: '',
        chequeName: '',
        bankName: '',
        chequeDate: '',
        chequeIssuedTo: '',
        note: draftExpense.note.trim(),
        allocationMode: 'single-site-multiple-payees',
        selectedProjectId: draftExpense.selectedProjectId,
        selectedProjectName: draftExpense.selectedProjectName,
        allocations: [],
        payees: normalizedPayees,
        updatedAt: new Date().toISOString(),
        createdAt: editingId ? draftExpense.createdAt || new Date().toISOString() : new Date().toISOString()
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
      return;
    }

    if (!draftExpense.payeeName.trim()) {
      alert('Payee name is required.');
      return;
    }

    const normalizedAllocations = (draftExpense.allocationMode === 'multiple' ? draftExpense.allocations : [])
      .filter((entry) => entry.projectId && Number(entry.amount || 0) > 0)
      .map((entry) => ({
        projectId: entry.projectId,
        projectName: entry.projectName || projects.find((project) => project.id === entry.projectId)?.name || 'Unknown site',
        amount: Number(entry.amount || 0),
        paymentMode: entry.paymentMode,
        ...normalizeChequeFields(entry)
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
        alert('Cheque number, cheque name, bank name, cheque date, and cheque given to are required for cheque payments.');
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
      if (normalizedAllocations.some((entry) => !entry.paymentMode)) {
        alert('Please choose a payment mode for each site allocation.');
        return;
      }
      if (normalizedAllocations.some((entry) => entry.paymentMode === 'cheque' && isChequeDetailsMissing(entry))) {
        alert('Cheque number, cheque name, bank name, cheque date, and cheque given to are required for each cheque allocation.');
        return;
      }
    }

    const rootChequeFields = normalizeChequeFields(draftExpense);
    const payload = {
      ...draftExpense,
      payeeMode: 'single',
      payeeName: draftExpense.payeeName.trim(),
      expenseTitle: draftExpense.expenseTitle.trim(),
      amount: amountValue,
      paymentMode: draftExpense.allocationMode === 'single' ? draftExpense.paymentMode : '',
      chequeNumber: draftExpense.allocationMode === 'single' ? rootChequeFields.chequeNumber : '',
      chequeName: draftExpense.allocationMode === 'single' ? rootChequeFields.chequeName : '',
      bankName: draftExpense.allocationMode === 'single' ? rootChequeFields.bankName : '',
      chequeDate: draftExpense.allocationMode === 'single' ? rootChequeFields.chequeDate : '',
      chequeIssuedTo: draftExpense.allocationMode === 'single' ? rootChequeFields.chequeIssuedTo : '',
      sourcePaymentId: draftExpense.allocationMode === 'single' ? rootChequeFields.sourcePaymentId : '',
      sourceChequeProjectId: draftExpense.allocationMode === 'single' ? rootChequeFields.sourceChequeProjectId : '',
      allocationMode: draftExpense.allocationMode,
      selectedProjectId: draftExpense.allocationMode === 'single' ? draftExpense.selectedProjectId : '',
      selectedProjectName: draftExpense.allocationMode === 'single' ? draftExpense.selectedProjectName : '',
      allocations: draftExpense.allocationMode === 'single'
        ? [{
          projectId: draftExpense.selectedProjectId,
          projectName: draftExpense.selectedProjectName || 'Unknown site',
          amount: amountValue,
          paymentMode: draftExpense.paymentMode,
          ...rootChequeFields
        }]
        : normalizedAllocations,
      payees: [],
      updatedAt: new Date().toISOString(),
      createdAt: editingId ? draftExpense.createdAt || new Date().toISOString() : new Date().toISOString()
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
    const payeeMode = entry.payeeMode || (entry.allocationMode === 'single-site-multiple-payees' ? 'multiple' : 'single');
    setDraftExpense({
      ...createInitialExpense(),
      ...entry,
      dateTime: entry.dateTime || getLocalDateTimeInputValue(),
      payeeMode,
      payeeType: entry.payeeType || 'vendor',
      payeeName: payeeMode === 'multiple' ? '' : entry.payeeName || '',
      expenseTitle: entry.expenseTitle || '',
      amount: entry.amount || '',
      paymentMode: entry.paymentMode || '',
      chequeIssuedTo: entry.chequeIssuedTo || '',
      note: entry.note || '',
      allocationMode: payeeMode === 'multiple' ? 'single-site-multiple-payees' : entry.allocationMode || 'single',
      selectedProjectId: entry.selectedProjectId || '',
      selectedProjectName: entry.selectedProjectName || '',
      allocations: entry.allocations?.length
        ? entry.allocations.map((allocation) => ({ ...createEmptyAllocation(), ...allocation }))
        : [createEmptyAllocation()],
      payees: entry.payees?.length
        ? entry.payees.map((payee) => ({ ...createEmptyPayee(), ...payee }))
        : [createEmptyPayee()]
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
      if (filters.payeeType && entry.payeeType !== filters.payeeType && !entry.payees?.some((payee) => payee.payeeType === filters.payeeType)) return false;
      if (filters.paymentMode) {
        const allocationHasMode = entry.allocations?.some((allocation) => allocation.paymentMode === filters.paymentMode);
        const payeeHasMode = entry.payees?.some((payee) => payee.paymentMode === filters.paymentMode);
        if (entry.paymentMode !== filters.paymentMode && !allocationHasMode && !payeeHasMode) return false;
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
        entry.chequeIssuedTo?.toLowerCase().includes(keyword) ||
        entry.allocations?.some((allocation) =>
          allocation.projectName?.toLowerCase().includes(keyword) ||
          allocation.paymentMode?.toLowerCase().includes(keyword) ||
          allocation.chequeNumber?.toLowerCase().includes(keyword) ||
          allocation.chequeName?.toLowerCase().includes(keyword) ||
          allocation.bankName?.toLowerCase().includes(keyword) ||
          allocation.chequeIssuedTo?.toLowerCase().includes(keyword)
        ) ||
        entry.payees?.some((payee) =>
          payee.payeeName?.toLowerCase().includes(keyword) ||
          payee.expenseTitle?.toLowerCase().includes(keyword) ||
          payee.paymentMode?.toLowerCase().includes(keyword) ||
          payee.chequeNumber?.toLowerCase().includes(keyword) ||
          payee.chequeName?.toLowerCase().includes(keyword) ||
          payee.bankName?.toLowerCase().includes(keyword) ||
          payee.chequeIssuedTo?.toLowerCase().includes(keyword)
        )
      );
    });
  }, [expenses, filters, searchTerm]);

  const totalAmount = filteredExpenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const payeeTotal = draftExpense.payees.reduce((sum, payee) => sum + Number(payee.amount || 0), 0);
  const allocationTotal = draftExpense.allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);

  const paymentModeSummary = (entry) => {
    if (entry.payeeMode === 'multiple' && entry.payees?.length) {
      return entry.payees
        .map((payee) => `${payee.payeeName || 'Payee'}: ${paymentModeLabel(payee.paymentMode)}`)
        .join(' | ');
    }
    if (entry.allocationMode === 'multiple' && entry.allocations?.length) {
      return entry.allocations
        .map((allocation) => `${allocation.projectName || 'Site'}: ${paymentModeLabel(allocation.paymentMode)}`)
        .join(' | ');
    }
    return paymentModeLabel(entry.paymentMode);
  };

  const chequeSummary = (entry) => {
    const chequeEntries = entry.payeeMode === 'multiple'
      ? (entry.payees || [])
        .filter((payee) => payee.paymentMode === 'cheque')
        .map((payee) => ({ title: payee.payeeName || 'Payee', ...payee }))
      : entry.allocationMode === 'multiple'
        ? (entry.allocations || [])
          .filter((allocation) => allocation.paymentMode === 'cheque')
          .map((allocation) => ({ title: allocation.projectName || 'Site', ...allocation }))
        : entry.paymentMode === 'cheque'
          ? [{ title: 'Main payment', ...entry }]
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
            <p>Given To: {cheque.chequeIssuedTo || '-'}</p>
          </div>
        ))}
      </div>
    );
  };

  const allocationSummary = (entry) => {
    if (entry.payeeMode === 'multiple' && entry.payees?.length) {
      return entry.payees.map((payee) => {
        const cheque = payee.paymentMode === 'cheque' ? ` | Cheque: ${payee.chequeNumber || '-'} -> ${payee.chequeIssuedTo || '-'}` : '';
        return `${payee.payeeName || 'Payee'}: ${formatAmount(payee.amount)} | ${paymentModeLabel(payee.paymentMode)}${cheque}`;
      }).join(' | ');
    }
    if (entry.allocationMode === 'multiple' && entry.allocations?.length) {
      return entry.allocations.map((item) => {
        const paymentMode = item.paymentMode ? ` | ${paymentModeLabel(item.paymentMode)}` : '';
        const cheque = item.paymentMode === 'cheque' ? ` | Cheque: ${item.chequeNumber || '-'} -> ${item.chequeIssuedTo || '-'}` : '';
        return `${item.projectName || 'Unknown site'}: ${formatAmount(item.amount)}${paymentMode}${cheque}`;
      }).join(' | ');
    }
    return entry.selectedProjectName || 'No site selected';
  };

  const updateAllocation = (index, field, value) => {
    setDraftExpense((prev) => ({
      ...prev,
      allocations: prev.allocations.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        if (field === 'project') {
          const project = projects.find((item) => item.id === value);
          return { ...entry, projectId: value, projectName: project?.name || '', sourcePaymentId: '', sourceChequeProjectId: '' };
        }
        if (field === 'paymentMode' && value !== 'cheque') {
          return { ...entry, paymentMode: value, chequeNumber: '', chequeName: '', bankName: '', chequeDate: '', chequeIssuedTo: '', sourcePaymentId: '', sourceChequeProjectId: '' };
        }
        if (field === 'chequeNumber') {
          return hydrateChequeDetails(entry, findClientCheque(entry.projectId, value), value);
        }
        if (field === 'sourcePaymentId') {
          const cheque = clientCheques.find((item) => item.id === value);
          return hydrateChequeDetails(entry, cheque || null);
        }
        return { ...entry, [field]: value };
      })
    }));
  };

  const updatePayee = (index, field, value) => {
    setDraftExpense((prev) => ({
      ...prev,
      payees: prev.payees.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        if (field === 'paymentMode' && value !== 'cheque') {
          return { ...entry, paymentMode: value, chequeNumber: '', chequeName: '', bankName: '', chequeDate: '', chequeIssuedTo: '', sourcePaymentId: '', sourceChequeProjectId: '' };
        }
        if (field === 'chequeNumber') {
          return hydrateChequeDetails(entry, findClientCheque(prev.selectedProjectId, value), value);
        }
        if (field === 'sourcePaymentId') {
          const cheque = clientCheques.find((item) => item.id === value);
          return hydrateChequeDetails(entry, cheque || null);
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

  const addPayee = () => {
    setDraftExpense((prev) => ({ ...prev, payees: [...prev.payees, createEmptyPayee()] }));
  };

  const removePayee = (index) => {
    setDraftExpense((prev) => ({
      ...prev,
      payees: prev.payees.filter((_, entryIndex) => entryIndex !== index)
    }));
  };

  const renderChequePicker = (projectId, selectedPaymentId, onSelect) => {
    const options = chequeOptionsForProject(projectId);
    return (
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Use Client Cheque</label>
        <select value={selectedPaymentId || ''} onChange={(event) => onSelect(event.target.value)} className="input-field">
          <option value="">Select received cheque</option>
          {options.map((cheque) => (
            <option key={`${cheque.projectId}-${cheque.id}`} value={cheque.id}>
              {cheque.chequeNumber} - {cheque.chequeName || 'Client cheque'} - {formatAmount(cheque.amount)}
            </option>
          ))}
        </select>
        {!options.length && <p className="mt-1 text-xs text-slate-500">No Payment In cheques found for this site yet.</p>}
      </div>
    );
  };

  const renderChequeMatch = (projectId, chequeNumber) => {
    const match = findClientCheque(projectId, chequeNumber);
    if (!match) return null;
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        Received cheque matched: {match.chequeName || '-'} | {match.bankName || '-'} | {match.chequeDate || '-'} | {match.projectName}
      </div>
    );
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
            <p className="text-sm text-slate-600">Record vendor, contractor, staff, and shared site expenses with cheque handover tracking.</p>
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
                placeholder="Payee, expense, cheque, bank, given to"
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
        <p className="text-xs uppercase tracking-wide text-slate-500">Filtered Other Expenses</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{formatAmount(totalAmount)}</p>
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
                {['Date & Time', 'Payee', 'Expense', 'Amount', 'Mode', 'Site / Payee Allocation', 'Cheque Details', 'Note', 'Actions'].map((head) => (
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
                    {entry.payeeMode === 'multiple' ? (
                      <>
                        <p className="font-medium text-slate-900">Multiple payees</p>
                        <p className="text-xs text-slate-500">{entry.payees?.map((payee) => payee.payeeName).filter(Boolean).join(', ') || '-'}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-slate-900">{entry.payeeName || '-'}</p>
                        <p className="capitalize">{entry.payeeType || '-'}</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{entry.expenseTitle || '-'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatAmount(entry.amount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 capitalize">{paymentModeSummary(entry)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">
                      {entry.payeeMode === 'multiple' ? `Single site: ${entry.selectedProjectName || '-'}` : entry.allocationMode === 'multiple' ? 'Split across sites' : 'Single site'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{allocationSummary(entry)}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{chequeSummary(entry)}</td>
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

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  <label className="mb-2 block text-sm font-medium text-slate-700">Total Amount (INR)</label>
                  <input
                    type="number"
                    min="0"
                    value={draftExpense.amount}
                    onChange={(event) => setDraftExpense((prev) => ({ ...prev, amount: event.target.value }))}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Expense Title</label>
                  <input
                    value={draftExpense.expenseTitle}
                    onChange={(event) => setDraftExpense((prev) => ({ ...prev, expenseTitle: event.target.value }))}
                    className="input-field"
                    placeholder="Bulk vendor payment / Site expense"
                  />
                </div>

                <div className="md:col-span-2 xl:col-span-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Payment Flow</label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className={`rounded-xl border p-3 text-sm transition ${draftExpense.payeeMode === 'single' ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700'}`}>
                      <input
                        type="radio"
                        className="mr-2"
                        checked={draftExpense.payeeMode === 'single'}
                        onChange={() => setDraftExpense((prev) => ({ ...prev, payeeMode: 'single', allocationMode: prev.allocationMode === 'single-site-multiple-payees' ? 'single' : prev.allocationMode }))}
                      />
                      One vendor or contractor, assigned to one or many sites
                    </label>
                    <label className={`rounded-xl border p-3 text-sm transition ${draftExpense.payeeMode === 'multiple' ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700'}`}>
                      <input
                        type="radio"
                        className="mr-2"
                        checked={draftExpense.payeeMode === 'multiple'}
                        onChange={() => setDraftExpense((prev) => ({
                          ...prev,
                          payeeMode: 'multiple',
                          allocationMode: 'single-site-multiple-payees',
                          paymentMode: '',
                          chequeNumber: '',
                          chequeName: '',
                          bankName: '',
                          chequeDate: '',
                          chequeIssuedTo: '',
                          payees: prev.payees.length ? prev.payees : [createEmptyPayee()]
                        }))}
                      />
                      One site pays multiple vendors or contractors
                    </label>
                  </div>
                </div>

                {draftExpense.payeeMode === 'single' && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Payee Type</label>
                      <select
                        value={draftExpense.payeeType}
                        onChange={(event) => setDraftExpense((prev) => ({ ...prev, payeeType: event.target.value }))}
                        className="input-field"
                      >
                        {payeeTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
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

                    {draftExpense.allocationMode === 'single' && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Payment Mode</label>
                        <select
                          value={draftExpense.paymentMode}
                          onChange={(event) => setDraftExpense((prev) => ({
                            ...prev,
                            paymentMode: event.target.value,
                            ...(event.target.value === 'cheque' ? {} : { chequeNumber: '', chequeName: '', bankName: '', chequeDate: '', chequeIssuedTo: '', sourcePaymentId: '', sourceChequeProjectId: '' })
                          }))}
                          className="input-field"
                        >
                          <option value="">Select payment mode</option>
                          {paymentModeOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="md:col-span-2 xl:col-span-4">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Site / Project Allocation</label>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
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
                                chequeIssuedTo: '',
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
                              onChange={(event) => {
                                const project = projects.find((item) => item.id === event.target.value);
                                setDraftExpense((prev) => ({
                                  ...prev,
                                  selectedProjectId: event.target.value,
                                  selectedProjectName: project?.name || '',
                                  sourcePaymentId: '',
                                  sourceChequeProjectId: ''
                                }));
                              }}
                              className="input-field"
                            >
                              <option value="">Select a site</option>
                              {projects.map((project) => (
                                <option key={project.id} value={project.id}>{project.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-700">Distribution across sites</p>
                                <p className="text-xs text-slate-500">Allocated total: {formatAmount(allocationTotal)}</p>
                              </div>
                              <button type="button" onClick={addAllocation} className="neutral-btn h-8 px-3 py-1 text-xs">
                                + Add site
                              </button>
                            </div>

                            {draftExpense.allocations.map((allocation, index) => (
                              <div key={`${allocation.projectId || 'new'}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_0.6fr_0.8fr_auto]">
                                  <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Site</label>
                                    <select value={allocation.projectId} onChange={(event) => updateAllocation(index, 'project', event.target.value)} className="input-field">
                                      <option value="">Select site</option>
                                      {projects.map((project) => (
                                        <option key={project.id} value={project.id}>{project.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</label>
                                    <input type="number" min="0" value={allocation.amount} onChange={(event) => updateAllocation(index, 'amount', event.target.value)} className="input-field" placeholder="0" />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Mode</label>
                                    <select value={allocation.paymentMode} onChange={(event) => updateAllocation(index, 'paymentMode', event.target.value)} className="input-field">
                                      <option value="">Select payment mode</option>
                                      {paymentModeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex items-end">
                                    <button type="button" onClick={() => removeAllocation(index)} className="neutral-btn h-10 px-3 text-xs" disabled={draftExpense.allocations.length === 1}>
                                      Remove
                                    </button>
                                  </div>
                                </div>

                                {allocation.paymentMode === 'cheque' && (
                                  <div className="mt-3 grid gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 md:grid-cols-2 xl:grid-cols-5">
                                    {renderChequePicker(allocation.projectId, allocation.sourcePaymentId, (value) => updateAllocation(index, 'sourcePaymentId', value))}
                                    <div>
                                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Number</label>
                                      <input value={allocation.chequeNumber} onChange={(event) => updateAllocation(index, 'chequeNumber', event.target.value)} className="input-field" placeholder="Enter cheque number" />
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Name</label>
                                      <input value={allocation.chequeName} onChange={(event) => updateAllocation(index, 'chequeName', event.target.value)} className="input-field" placeholder="Name on cheque" />
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Bank Name</label>
                                      <input value={allocation.bankName} onChange={(event) => updateAllocation(index, 'bankName', event.target.value)} className="input-field" placeholder="Bank name" />
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Date</label>
                                      <input type="date" value={allocation.chequeDate} onChange={(event) => updateAllocation(index, 'chequeDate', event.target.value)} className="input-field" />
                                    </div>
                                    <div className="md:col-span-2 xl:col-span-5">
                                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Given To</label>
                                      <input value={allocation.chequeIssuedTo} onChange={(event) => updateAllocation(index, 'chequeIssuedTo', event.target.value)} className="input-field" placeholder="Person receiving this cheque" />
                                    </div>
                                    <div className="md:col-span-2 xl:col-span-5">{renderChequeMatch(allocation.projectId, allocation.chequeNumber)}</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {draftExpense.allocationMode === 'single' && draftExpense.paymentMode === 'cheque' && (
                      <div className="md:col-span-2 xl:col-span-4">
                        <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 md:grid-cols-2 xl:grid-cols-5">
                          {renderChequePicker(draftExpense.selectedProjectId, draftExpense.sourcePaymentId, (value) => {
                            const cheque = clientCheques.find((item) => item.id === value);
                            setDraftExpense((prev) => hydrateChequeDetails(prev, cheque || null));
                          })}
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Number</label>
                            <input
                              value={draftExpense.chequeNumber}
                              onChange={(event) => setDraftExpense((prev) => hydrateChequeDetails(prev, findClientCheque(prev.selectedProjectId, event.target.value), event.target.value))}
                              className="input-field"
                              placeholder="Enter cheque number"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Name</label>
                            <input value={draftExpense.chequeName} onChange={(event) => setDraftExpense((prev) => ({ ...prev, chequeName: event.target.value }))} className="input-field" placeholder="Name on cheque" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Bank Name</label>
                            <input value={draftExpense.bankName} onChange={(event) => setDraftExpense((prev) => ({ ...prev, bankName: event.target.value }))} className="input-field" placeholder="Bank name" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Date</label>
                            <input type="date" value={draftExpense.chequeDate} onChange={(event) => setDraftExpense((prev) => ({ ...prev, chequeDate: event.target.value }))} className="input-field" />
                          </div>
                          <div className="md:col-span-2 xl:col-span-5">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Given To</label>
                            <input value={draftExpense.chequeIssuedTo} onChange={(event) => setDraftExpense((prev) => ({ ...prev, chequeIssuedTo: event.target.value }))} className="input-field" placeholder="Person receiving this cheque" />
                          </div>
                          <div className="md:col-span-2 xl:col-span-5">{renderChequeMatch(draftExpense.selectedProjectId, draftExpense.chequeNumber)}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {draftExpense.payeeMode === 'multiple' && (
                  <div className="md:col-span-2 xl:col-span-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Site paying multiple vendors</label>
                          <select
                            value={draftExpense.selectedProjectId}
                            onChange={(event) => {
                              const project = projects.find((item) => item.id === event.target.value);
                              setDraftExpense((prev) => ({
                                ...prev,
                                selectedProjectId: event.target.value,
                                selectedProjectName: project?.name || '',
                                payees: prev.payees.map((payee) => ({ ...payee, sourcePaymentId: '', sourceChequeProjectId: '' }))
                              }));
                            }}
                            className="input-field"
                          >
                            <option value="">Select a site</option>
                            {projects.map((project) => (
                              <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Payee Total</p>
                          <p className={`font-semibold ${Math.abs(payeeTotal - Number(draftExpense.amount || 0)) <= 0.01 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {formatAmount(payeeTotal)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-800">Vendors and contractors</p>
                          <button type="button" onClick={addPayee} className="neutral-btn h-8 px-3 py-1 text-xs">
                            + Add payee
                          </button>
                        </div>

                        {draftExpense.payees.map((payee, index) => (
                          <div key={`${payee.payeeName || 'new'}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[0.7fr_1fr_1fr_0.65fr_0.8fr_auto]">
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Type</label>
                                <select value={payee.payeeType} onChange={(event) => updatePayee(index, 'payeeType', event.target.value)} className="input-field">
                                  {payeeTypeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</label>
                                <input value={payee.payeeName} onChange={(event) => updatePayee(index, 'payeeName', event.target.value)} className="input-field" placeholder="Vendor / contractor name" />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Expense</label>
                                <input value={payee.expenseTitle} onChange={(event) => updatePayee(index, 'expenseTitle', event.target.value)} className="input-field" placeholder="Optional item title" />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</label>
                                <input type="number" min="0" value={payee.amount} onChange={(event) => updatePayee(index, 'amount', event.target.value)} className="input-field" placeholder="0" />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Mode</label>
                                <select value={payee.paymentMode} onChange={(event) => updatePayee(index, 'paymentMode', event.target.value)} className="input-field">
                                  <option value="">Select payment mode</option>
                                  {paymentModeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-end">
                                <button type="button" onClick={() => removePayee(index)} className="neutral-btn h-10 px-3 text-xs" disabled={draftExpense.payees.length === 1}>
                                  Remove
                                </button>
                              </div>
                            </div>

                            {payee.paymentMode === 'cheque' && (
                              <div className="mt-3 grid gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 md:grid-cols-2 xl:grid-cols-5">
                                {renderChequePicker(draftExpense.selectedProjectId, payee.sourcePaymentId, (value) => updatePayee(index, 'sourcePaymentId', value))}
                                <div>
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Number</label>
                                  <input value={payee.chequeNumber} onChange={(event) => updatePayee(index, 'chequeNumber', event.target.value)} className="input-field" placeholder="Enter cheque number" />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Name</label>
                                  <input value={payee.chequeName} onChange={(event) => updatePayee(index, 'chequeName', event.target.value)} className="input-field" placeholder="Name on cheque" />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Bank Name</label>
                                  <input value={payee.bankName} onChange={(event) => updatePayee(index, 'bankName', event.target.value)} className="input-field" placeholder="Bank name" />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Date</label>
                                  <input type="date" value={payee.chequeDate} onChange={(event) => updatePayee(index, 'chequeDate', event.target.value)} className="input-field" />
                                </div>
                                <div className="md:col-span-2 xl:col-span-5">
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Given To</label>
                                  <input value={payee.chequeIssuedTo} onChange={(event) => updatePayee(index, 'chequeIssuedTo', event.target.value)} className="input-field" placeholder="Person receiving this cheque" />
                                </div>
                                <div className="md:col-span-2 xl:col-span-5">{renderChequeMatch(draftExpense.selectedProjectId, payee.chequeNumber)}</div>
                              </div>
                            )}

                            <div className="mt-3">
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Payee Note</label>
                              <input value={payee.note} onChange={(event) => updatePayee(index, 'note', event.target.value)} className="input-field" placeholder="Optional payee note" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

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
