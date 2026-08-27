import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { ArrowDownCircle, ArrowUpCircle, Edit2, List, MessageCircle, Plus, Search, Tags, Trash2, X } from 'lucide-react';
import { db } from '../../Firebase/config';
import FilterBar from '../Common/FilterBar';
import ExportButton from '../Common/ExportButton';
import { getLocalDateTimeInputValue, isDateWithinRange } from '../../utils/dateTime';
import { openWhatsAppMessage } from '../../utils/whatsapp';
import { formatCurrency, getAllocatedExpensesForProject } from '../../utils/projectFinance';

const paymentModeOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank-transfer', label: 'Bank Transfer' }
];

const paymentTypeOptions = [
  { value: 'in', label: 'Payment In' },
  { value: 'out', label: 'Payment Out' }
];

const createEmptyPaymentSplit = () => ({
  amount: '',
  paymentMode: '',
  chequeNumber: '',
  chequeName: '',
  bankName: '',
  chequeDate: ''
});

const createInitialEntry = () => ({
  dateTime: getLocalDateTimeInputValue(),
  amount: '',
  paymentMode: '',
  chequeNumber: '',
  chequeName: '',
  bankName: '',
  chequeDate: '',
  paymentSplits: [createEmptyPaymentSplit()],
  paymentType: '',
  categoryId: '',
  categoryName: '',
  note: ''
});

const initialCategoryState = {
  name: ''
};

const Payments = () => {
  const { projectId } = useParams();
  const [payments, setPayments] = useState([]);
  const [paymentCategories, setPaymentCategories] = useState([]);
  const [allocatedExpenses, setAllocatedExpenses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryWorkspaceOpen, setIsCategoryWorkspaceOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [draftEntry, setDraftEntry] = useState(createInitialEntry);
  const [draftCategory, setDraftCategory] = useState(initialCategoryState);
  const [editingId, setEditingId] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFiltersOnMobile, setShowFiltersOnMobile] = useState(false);
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [whatsappContext, setWhatsappContext] = useState(null);
  const [whatsappDraft, setWhatsappDraft] = useState({
    sendType: 'single',
    fromDate: '',
    toDate: '',
    phoneNumber: ''
  });

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    paymentMode: '',
    paymentType: '',
    categoryId: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [paymentSnapshot, categorySnapshot, expenseSnapshot] = await Promise.all([
        getDocs(collection(db, `projects/${projectId}/payments`)),
        getDocs(collection(db, 'paymentCategories')),
        getDocs(collection(db, 'expenses'))
      ]);
      const entries = paymentSnapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
      const categories = categorySnapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const expenses = expenseSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

      setPayments(entries);
      setPaymentCategories(categories);
      setAllocatedExpenses(getAllocatedExpensesForProject(expenses, projectId));
    } catch (error) {
      console.error('Error loading payments:', error);
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
    setDraftEntry(createInitialEntry());
    setEditingId(null);
    setIsModalOpen(true);
  };

  const cleanText = (value) => String(value || '').trim();
  const matchesKeyword = (value, keyword) => String(value || '').toLowerCase().includes(keyword);
  const paymentModeLabel = (value) => paymentModeOptions.find((option) => option.value === value)?.label || (value || '-').replace('-', ' ');

  const getPaymentSplits = (entry) => {
    if (Array.isArray(entry.paymentSplits) && entry.paymentSplits.length) {
      return entry.paymentSplits.map((split) => ({
        ...createEmptyPaymentSplit(),
        ...split,
        amount: split.amount ?? ''
      }));
    }

    return [{
      amount: entry.amount || '',
      paymentMode: entry.paymentMode || '',
      chequeNumber: entry.chequeNumber || '',
      chequeName: entry.chequeName || '',
      bankName: entry.bankName || '',
      chequeDate: entry.chequeDate || ''
    }];
  };

  const hasSplitContent = (split) =>
    split.paymentMode ||
    Number(split.amount || 0) > 0 ||
    cleanText(split.chequeNumber) ||
    cleanText(split.chequeName) ||
    cleanText(split.bankName) ||
    split.chequeDate;

  const normalizeChequeFields = (split) => ({
    chequeNumber: split.paymentMode === 'cheque' ? cleanText(split.chequeNumber) : '',
    chequeName: split.paymentMode === 'cheque' ? cleanText(split.chequeName) : '',
    bankName: split.paymentMode === 'cheque' ? cleanText(split.bankName) : '',
    chequeDate: split.paymentMode === 'cheque' ? split.chequeDate : ''
  });

  const isChequeDetailsMissing = (split) =>
    !cleanText(split.chequeNumber) ||
    !cleanText(split.chequeName) ||
    !cleanText(split.bankName) ||
    !split.chequeDate;

  const paymentSplitTotal = draftEntry.paymentSplits.reduce((sum, split) => sum + Number(split.amount || 0), 0);
  const paymentSplitRemaining = Number(draftEntry.amount || 0) - paymentSplitTotal;

  const paymentModeSummary = (entry) => {
    const splits = getPaymentSplits(entry).filter((split) => split.paymentMode || Number(split.amount || 0) > 0);
    if (!splits.length) return '-';

    return splits
      .map((split) => `${paymentModeLabel(split.paymentMode)}: ${formatCurrency(split.amount)}`)
      .join(' | ');
  };

  const chequeSummary = (entry) => {
    const chequeSplits = getPaymentSplits(entry).filter((split) => split.paymentMode === 'cheque');
    if (!chequeSplits.length) return '-';

    return (
      <div className="space-y-2">
        {chequeSplits.map((split, index) => (
          <div key={`${split.chequeNumber || 'cheque'}-${index}`} className="space-y-0.5">
            <p className="font-medium text-slate-900">Cheque {index + 1}: {formatCurrency(split.amount)}</p>
            <p>No: {split.chequeNumber || '-'}</p>
            <p>Name: {split.chequeName || '-'}</p>
            <p>Bank: {split.bankName || '-'}</p>
            <p>Date: {split.chequeDate || '-'}</p>
          </div>
        ))}
      </div>
    );
  };

  const updatePaymentSplit = (index, field, value) => {
    setDraftEntry((prev) => ({
      ...prev,
      paymentSplits: prev.paymentSplits.map((split, splitIndex) => {
        if (splitIndex !== index) return split;
        if (field === 'paymentMode' && value !== 'cheque') {
          return { ...split, paymentMode: value, chequeNumber: '', chequeName: '', bankName: '', chequeDate: '' };
        }
        return { ...split, [field]: value };
      })
    }));
  };

  const addPaymentSplit = () => {
    setDraftEntry((prev) => ({ ...prev, paymentSplits: [...prev.paymentSplits, createEmptyPaymentSplit()] }));
  };

  const removePaymentSplit = (index) => {
    setDraftEntry((prev) => ({
      ...prev,
      paymentSplits: prev.paymentSplits.length === 1
        ? prev.paymentSplits
        : prev.paymentSplits.filter((_, splitIndex) => splitIndex !== index)
    }));
  };

  const savePayment = async () => {
    if (!draftEntry.dateTime || !draftEntry.amount || !draftEntry.paymentType || !draftEntry.categoryId) {
      alert('Date, amount, payment type, and category are required.');
      return;
    }

    const amountValue = Number(draftEntry.amount);
    if (amountValue <= 0) {
      alert('Amount must be greater than zero.');
      return;
    }

    const normalizedSplits = draftEntry.paymentSplits
      .filter(hasSplitContent)
      .map((split) => ({
        amount: Number(split.amount || 0),
        paymentMode: split.paymentMode,
        ...normalizeChequeFields(split)
      }));

    if (!normalizedSplits.length) {
      alert('Please add at least one payment split.');
      return;
    }
    if (normalizedSplits.some((split) => !split.paymentMode || split.amount <= 0)) {
      alert('Every payment split needs a payment mode and amount greater than zero.');
      return;
    }
    if (Math.abs(normalizedSplits.reduce((sum, split) => sum + split.amount, 0) - amountValue) > 0.01) {
      alert('The total of all payment splits must exactly match the payment amount.');
      return;
    }
    if (normalizedSplits.some((split) => split.paymentMode === 'cheque' && isChequeDetailsMissing(split))) {
      alert('Cheque number, cheque name, bank name, and cheque date are required for every cheque split.');
      return;
    }

    const firstSplit = normalizedSplits[0] || createEmptyPaymentSplit();
    const firstChequeSplit = normalizedSplits.find((split) => split.paymentMode === 'cheque') || createEmptyPaymentSplit();
    const payload = {
      ...draftEntry,
      amount: amountValue,
      paymentMode: normalizedSplits.length === 1 ? firstSplit.paymentMode : 'multiple',
      paymentSplits: normalizedSplits,
      splitPayment: normalizedSplits.length > 1,
      categoryName: paymentCategories.find((category) => category.id === draftEntry.categoryId)?.name || draftEntry.categoryName || '',
      chequeNumber: firstChequeSplit.chequeNumber || '',
      chequeName: firstChequeSplit.chequeName || '',
      bankName: firstChequeSplit.bankName || '',
      chequeDate: firstChequeSplit.chequeDate || '',
      updatedAt: new Date().toISOString(),
      createdAt: editingId ? draftEntry.createdAt || new Date().toISOString() : new Date().toISOString()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, `projects/${projectId}/payments`, editingId), payload);
      } else {
        await addDoc(collection(db, `projects/${projectId}/payments`), payload);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setDraftEntry(createInitialEntry());
      loadData();
    } catch (error) {
      console.error('Error saving payment entry:', error);
    }
  };

  const editEntry = (entry) => {
    setDraftEntry({
      ...createInitialEntry(),
      dateTime: entry.dateTime || getLocalDateTimeInputValue(),
      amount: entry.amount || '',
      paymentMode: entry.paymentMode || '',
      chequeNumber: entry.chequeNumber || '',
      chequeName: entry.chequeName || '',
      bankName: entry.bankName || '',
      chequeDate: entry.chequeDate || '',
      paymentSplits: getPaymentSplits(entry),
      paymentType: entry.paymentType || '',
      categoryId: entry.categoryId || '',
      categoryName: entry.categoryName || '',
      note: entry.note || '',
      createdAt: entry.createdAt || ''
    });
    setEditingId(entry.id);
    setIsModalOpen(true);
  };

  const deleteEntry = async (id) => {
    if (!window.confirm('Delete this payment entry?')) return;
    try {
      await deleteDoc(doc(db, `projects/${projectId}/payments`, id));
      loadData();
    } catch (error) {
      console.error('Error deleting payment entry:', error);
    }
  };

  const resetCategoryState = () => {
    setDraftCategory(initialCategoryState);
    setEditingCategoryId(null);
  };

  const saveCategory = async () => {
    if (!draftCategory.name.trim()) {
      alert('Category name is required.');
      return;
    }

    const payload = { name: draftCategory.name.trim() };

    try {
      if (editingCategoryId) {
        await updateDoc(doc(db, 'paymentCategories', editingCategoryId), payload);
      } else {
        await addDoc(collection(db, 'paymentCategories'), payload);
      }

      setIsCategoryModalOpen(false);
      resetCategoryState();
      loadData();
    } catch (error) {
      console.error('Error saving payment category:', error);
    }
  };

  const editCategory = (category) => {
    setDraftCategory({ name: category.name || '' });
    setEditingCategoryId(category.id);
    setIsCategoryModalOpen(true);
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Delete this payment category?')) return;

    try {
      await deleteDoc(doc(db, 'paymentCategories', id));
      loadData();
    } catch (error) {
      console.error('Error deleting payment category:', error);
    }
  };

  const openWhatsappModal = (entry) => {
    const dateKey = String(entry.dateTime || '').slice(0, 10);
    setWhatsappContext(entry);
    setWhatsappDraft({
      sendType: 'single',
      fromDate: dateKey,
      toDate: dateKey,
      phoneNumber: ''
    });
    setIsWhatsappModalOpen(true);
  };

  const sendPaymentWhatsapp = () => {
    if (!whatsappContext) return;
    if (!whatsappDraft.phoneNumber.trim()) {
      alert('Please enter a WhatsApp number.');
      return;
    }

    const selectedEntries =
      whatsappDraft.sendType === 'single'
        ? payments.filter((entry) => entry.id === whatsappContext.id)
        : payments.filter((entry) => isDateWithinRange(entry.dateTime, whatsappDraft.fromDate, whatsappDraft.toDate));

    if (!selectedEntries.length) {
      alert('No payment entries found for selected range.');
      return;
    }

    const totalAmount = selectedEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const lines = selectedEntries.map((entry, index) => {
      const splitLines = getPaymentSplits(entry).map((split, splitIndex) => {
        const cheque = split.paymentMode === 'cheque'
          ? ` | Cheque: ${split.chequeNumber || '-'}, ${split.chequeName || '-'}, ${split.bankName || '-'}, ${split.chequeDate || '-'}`
          : '';
        return `Split ${splitIndex + 1}: INR ${Number(split.amount || 0).toLocaleString('en-IN')} via ${paymentModeLabel(split.paymentMode)}${cheque}`;
      });

      return [
        `${index + 1}. Date: ${new Date(entry.dateTime).toLocaleString('en-IN')}`,
        `Amount: INR ${Number(entry.amount || 0).toLocaleString('en-IN')}`,
        `Payment Split: ${splitLines.join(' | ')}`,
        `Type: ${entry.paymentType === 'in' ? 'Payment In' : 'Payment Out'}`,
        `Category: ${entry.categoryName || '-'}`,
        `Note: ${entry.note || '-'}`
      ].join('\n');
    });

    const message = [
      'Payment Details',
      whatsappDraft.sendType === 'single'
        ? 'Scope: Single Entry'
        : `Scope: Date Range (${whatsappDraft.fromDate || '-'} to ${whatsappDraft.toDate || '-'})`,
      `Entries: ${selectedEntries.length}`,
      `Total Amount: INR ${totalAmount.toLocaleString('en-IN')}`,
      '',
      ...lines
    ].join('\n');

    const sent = openWhatsAppMessage(whatsappDraft.phoneNumber, message);
    if (!sent) {
      alert('Could not open WhatsApp. Please check number format.');
      return;
    }

    setIsWhatsappModalOpen(false);
    setWhatsappContext(null);
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((entry) => {
      const entryDate = new Date(entry.dateTime);
      const startDate = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
      const endDate = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;

      if (startDate && entryDate < startDate) return false;
      if (endDate && entryDate > endDate) return false;
      const entrySplits = getPaymentSplits(entry);
      if (filters.paymentMode && entry.paymentMode !== filters.paymentMode && !entrySplits.some((split) => split.paymentMode === filters.paymentMode)) return false;
      if (filters.paymentType && entry.paymentType !== filters.paymentType) return false;
      if (filters.categoryId && entry.categoryId !== filters.categoryId) return false;

      if (!searchTerm.trim()) return true;
      const keyword = searchTerm.toLowerCase();
      return (
        matchesKeyword(entry.note, keyword) ||
        matchesKeyword(entry.categoryName, keyword) ||
        matchesKeyword(entry.paymentMode, keyword) ||
        matchesKeyword(entry.paymentType, keyword) ||
        matchesKeyword(entry.chequeNumber, keyword) ||
        matchesKeyword(entry.chequeName, keyword) ||
        matchesKeyword(entry.bankName, keyword) ||
        entrySplits.some((split) =>
          paymentModeLabel(split.paymentMode).toLowerCase().includes(keyword) ||
          matchesKeyword(split.chequeNumber, keyword) ||
          matchesKeyword(split.chequeName, keyword) ||
          matchesKeyword(split.bankName, keyword)
        )
      );
    });
  }, [payments, filters, searchTerm]);

  const totals = useMemo(() => {
    const paymentIn = filteredPayments
      .filter((entry) => entry.paymentType === 'in')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const paymentOut = filteredPayments
      .filter((entry) => entry.paymentType === 'out')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const allocatedExpenseOut = allocatedExpenses.reduce((sum, entry) => sum + Number(entry.allocationAmount || 0), 0);
    const totalOut = paymentOut + allocatedExpenseOut;

    return {
      paymentIn,
      paymentOut,
      allocatedExpenseOut,
      totalOut,
      difference: paymentIn - totalOut
    };
  }, [filteredPayments, allocatedExpenses]);

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
            <h2 className="text-xl font-semibold text-slate-900">Payments</h2>
            <p className="text-sm text-slate-600">Track payment in/out with mode-based and date-based filters.</p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button type="button" onClick={() => setIsCategoryWorkspaceOpen(true)} className="neutral-btn">
              <List className="h-4 w-4" />
              Category Master
            </button>
            <button type="button" onClick={openCreateModal} className="orange-btn">
              <Plus className="h-4 w-4" />
              Add Payment
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
                placeholder="Category, mode, note, cheque no., bank"
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
              dropdownKey="paymentMode"
              dropdownLabel="Payment Mode"
              dropdownOptions={paymentModeOptions}
              extraDropdowns={[
                {
                  key: 'paymentType',
                  label: 'Payment Type',
                  options: paymentTypeOptions
                },
                {
                  key: 'categoryId',
                  label: 'Category',
                  options: paymentCategories.map((category) => ({ value: category.id, label: category.name }))
                }
              ]}
            />
          </div>

          <div className="flex justify-end">
            <ExportButton data={filteredPayments} filename="payment_report" type="payment" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface-card border-l-4 border-l-emerald-500 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Payment In</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{formatCurrency(totals.paymentIn)}</p>
          <ArrowDownCircle className="mt-3 h-5 w-5 text-emerald-600" />
        </div>
        <div className="surface-card border-l-4 border-l-blue-500 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Direct Payment Out</p>
          <p className="mt-1 text-2xl font-semibold text-blue-700">{formatCurrency(totals.paymentOut)}</p>
          <ArrowUpCircle className="mt-3 h-5 w-5 text-blue-600" />
        </div>
        <div className="surface-card border-l-4 border-l-slate-500 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Allocated Expenses</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(totals.allocatedExpenseOut)}</p>
          <p className="mt-2 text-xs text-slate-500">From Other Expenses split/assigned to this site</p>
        </div>
        <div className={`surface-card border-l-4 p-4 ${totals.difference >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
          <p className="text-xs uppercase tracking-wide text-slate-500">Difference</p>
          <p className={`mt-1 text-2xl font-semibold ${totals.difference >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {formatCurrency(totals.difference)}
          </p>
          <p className="mt-2 text-xs text-slate-500">Payment In - (Direct Out + Allocated Expenses)</p>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{filteredPayments.length}</span> filtered entries
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Date & Time', 'Amount', 'Mode', 'Category', 'Cheque Details', 'Type', 'Note', 'Actions'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/90">
              {filteredPayments.map((entry) => (
                <tr key={entry.id} className="hover:bg-blue-50/60">
                  <td className="px-4 py-3 text-sm text-slate-600">{new Date(entry.dateTime).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">INR {Number(entry.amount || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{paymentModeSummary(entry)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{entry.categoryName || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{chequeSummary(entry)}</td>
                  <td className={`px-4 py-3 text-sm font-semibold ${entry.paymentType === 'in' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {entry.paymentType === 'in' ? 'Payment In' : 'Payment Out'}
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

        {!filteredPayments.length && <div className="px-4 py-10 text-center text-sm text-slate-500">No payment entries found for selected filters.</div>}
      </section>

      {allocatedExpenses.length > 0 && (
        <section className="surface-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            <Tags className="h-4 w-4 text-blue-700" />
            Allocated Other Expenses
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Date & Time', 'Expense', 'Payee', 'Allocated Amount', 'Mode', 'Cheque Details', 'Note'].map((head) => (
                    <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/90">
                {allocatedExpenses.map((entry) => (
                  <tr key={`${entry.id}-${entry.allocationAmount}`} className="hover:bg-blue-50/60">
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(entry.dateTime).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{entry.expenseTitle || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{entry.payeeName || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatCurrency(entry.allocationAmount)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 capitalize">{(entry.allocationPaymentMode || entry.paymentMode || '-').replace('-', ' ')}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {entry.allocationPaymentMode === 'cheque' ? (
                        <div className="space-y-0.5">
                          <p>No: {entry.allocationChequeNumber || '-'}</p>
                          <p>Name: {entry.allocationChequeName || '-'}</p>
                          <p>Bank: {entry.allocationBankName || '-'}</p>
                          <p>Date: {entry.allocationChequeDate || '-'}</p>
                          <p>Given To: {entry.allocationChequeIssuedTo || '-'}</p>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{entry.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isCategoryWorkspaceOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-2 sm:p-4">
          <div className="glass-card h-full w-full overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 md:px-5 md:py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Payment Category Master</h3>
                <p className="text-sm text-slate-600">Create reusable categories for payment in and payment out entries.</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetCategoryState();
                    setIsCategoryModalOpen(true);
                  }}
                  className="orange-btn"
                >
                  <Plus className="h-4 w-4" />
                  Add Category
                </button>
                <button type="button" onClick={() => setIsCategoryWorkspaceOpen(false)} className="neutral-btn">
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>
            </div>

            <div className="h-[calc(100%-84px)] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-sm">
                  <tr>
                    {['Category', 'Actions'].map((head) => (
                      <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white/90">
                  {paymentCategories.map((category) => (
                    <tr key={category.id} className="hover:bg-blue-50/60">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{category.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => editCategory(category)} className="neutral-btn h-8 w-8 border-slate-200 p-0">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => deleteCategory(category.id)} className="neutral-btn h-8 w-8 border-slate-200 p-0 text-red-600 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!paymentCategories.length && <div className="px-4 py-10 text-center text-sm text-slate-500">No payment categories yet. Add your first category to begin.</div>}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card max-h-[92vh] w-full max-w-5xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Payment Entry' : 'Add Payment Entry'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="neutral-btn h-9 w-9 border-none p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Date & Time</label>
                <input
                  type="datetime-local"
                  value={draftEntry.dateTime}
                  onChange={(event) => setDraftEntry((prev) => ({ ...prev, dateTime: event.target.value }))}
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Amount (INR)</label>
                <input
                  type="number"
                  min="0"
                  value={draftEntry.amount}
                  onChange={(event) => setDraftEntry((prev) => ({ ...prev, amount: event.target.value }))}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Payment Type</label>
                <select
                  value={draftEntry.paymentType}
                  onChange={(event) => setDraftEntry((prev) => ({ ...prev, paymentType: event.target.value }))}
                  className="input-field"
                >
                  <option value="">Select payment type</option>
                  {paymentTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-slate-700">Category</label>
                  <button
                    type="button"
                    onClick={() => {
                      resetCategoryState();
                      setIsCategoryModalOpen(true);
                    }}
                    className="neutral-btn h-8 px-3 py-1 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Category
                  </button>
                </div>
                <select
                  value={draftEntry.categoryId}
                  onChange={(event) => {
                    const category = paymentCategories.find((item) => item.id === event.target.value);
                    setDraftEntry((prev) => ({ ...prev, categoryId: event.target.value, categoryName: category?.name || '' }));
                  }}
                  className="input-field"
                >
                  <option value="">Select category</option>
                  {paymentCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Payment Split</p>
                      <p className="text-xs text-slate-500">
                        Split total: {formatCurrency(paymentSplitTotal)} | Remaining: {formatCurrency(paymentSplitRemaining)}
                      </p>
                    </div>
                    <button type="button" onClick={addPaymentSplit} className="neutral-btn h-8 px-3 py-1 text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      Add Mode
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {draftEntry.paymentSplits.map((split, index) => (
                      <div key={`${split.paymentMode || 'split'}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="grid gap-3 md:grid-cols-[0.7fr_1fr_auto] md:items-end">
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</label>
                            <input
                              type="number"
                              min="0"
                              value={split.amount}
                              onChange={(event) => updatePaymentSplit(index, 'amount', event.target.value)}
                              className="input-field"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Mode</label>
                            <select
                              value={split.paymentMode}
                              onChange={(event) => updatePaymentSplit(index, 'paymentMode', event.target.value)}
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
                          <button
                            type="button"
                            onClick={() => removePaymentSplit(index)}
                            className="neutral-btn h-10 px-3 text-xs"
                            disabled={draftEntry.paymentSplits.length === 1}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>

                        {split.paymentMode === 'cheque' && (
                          <div className="mt-3 grid gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Number</label>
                              <input
                                value={split.chequeNumber}
                                onChange={(event) => updatePaymentSplit(index, 'chequeNumber', event.target.value)}
                                className="input-field"
                                placeholder="Enter cheque number"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Name</label>
                              <input
                                value={split.chequeName}
                                onChange={(event) => updatePaymentSplit(index, 'chequeName', event.target.value)}
                                className="input-field"
                                placeholder="Name on cheque"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Bank Name</label>
                              <input
                                value={split.bankName}
                                onChange={(event) => updatePaymentSplit(index, 'bankName', event.target.value)}
                                className="input-field"
                                placeholder="Bank name"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cheque Date</label>
                              <input
                                type="date"
                                value={split.chequeDate}
                                onChange={(event) => updatePaymentSplit(index, 'chequeDate', event.target.value)}
                                className="input-field"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
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
              <button type="button" onClick={savePayment} className="orange-btn">
                {editingId ? 'Update Entry' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-md">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{editingCategoryId ? 'Edit Payment Category' : 'Add Payment Category'}</h2>
              <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="neutral-btn h-9 w-9 border-none p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Category Name</label>
                <input
                  value={draftCategory.name}
                  onChange={(event) => setDraftCategory((prev) => ({ ...prev, name: event.target.value }))}
                  className="input-field"
                  placeholder="Material advance / Labour payout / Client receipt"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="neutral-btn">
                Cancel
              </button>
              <button type="button" onClick={saveCategory} className="orange-btn">
                {editingCategoryId ? 'Update Category' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isWhatsappModalOpen && whatsappContext && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Send Payment Details on WhatsApp</h3>
              <button type="button" onClick={() => setIsWhatsappModalOpen(false)} className="neutral-btn h-9 w-9 border-none p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">WhatsApp Number</label>
                <input
                  value={whatsappDraft.phoneNumber}
                  onChange={(event) => setWhatsappDraft((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                  className="input-field"
                  placeholder="91XXXXXXXXXX"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Send Type</label>
                <select
                  value={whatsappDraft.sendType}
                  onChange={(event) => setWhatsappDraft((prev) => ({ ...prev, sendType: event.target.value }))}
                  className="input-field"
                >
                  <option value="single">Only this selected entry</option>
                  <option value="datewise">Date-wise entries</option>
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
              <button type="button" onClick={sendPaymentWhatsapp} className="orange-btn">
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

export default Payments;


