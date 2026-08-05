import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { ArrowDownCircle, ArrowUpCircle, Download, Hammer, Layers3, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../Firebase/config';
import { getAllocatedExpensesForProject } from '../../utils/projectFinance';

const Reports = () => {
  const { projectId } = useParams();

  const [projectName, setProjectName] = useState('');
  const [materials, setMaterials] = useState([]);
  const [labour, setLabour] = useState([]);
  const [payments, setPayments] = useState([]);
  const [allocatedExpenses, setAllocatedExpenses] = useState([]);
  const [itemNames, setItemNames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [projectSnapshot, materialSnapshot, labourSnapshot, paymentSnapshot, itemSnapshot, expenseSnapshot] = await Promise.all([
          getDoc(doc(db, 'projects', projectId)),
          getDocs(collection(db, `projects/${projectId}/materials`)),
          getDocs(collection(db, `projects/${projectId}/labour`)),
          getDocs(collection(db, `projects/${projectId}/payments`)),
          getDocs(collection(db, 'itemNames')),
          getDocs(collection(db, 'expenses'))
        ]);

        setProjectName(projectSnapshot.exists() ? projectSnapshot.data().name || 'Project' : 'Project');
        setMaterials(materialSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })));
        setLabour(labourSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })));
        setPayments(paymentSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })));
        setItemNames(itemSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })));
        setAllocatedExpenses(getAllocatedExpensesForProject(expenseSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })), projectId));
      } catch (error) {
        console.error('Error loading reports data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId]);

  const itemLookup = useMemo(() => {
    return itemNames.reduce((accumulator, item) => {
      accumulator[item.id] = item.name;
      return accumulator;
    }, {});
  }, [itemNames]);

  const materialSummary = useMemo(() => {
    const grouped = {};
    materials.forEach((entry) => {
      const label = itemLookup[entry.itemName] || 'Unknown';
      if (!grouped[label]) grouped[label] = { name: label, amount: 0, entries: 0 };
      grouped[label].amount += Number(entry.finalAmount || 0);
      grouped[label].entries += 1;
    });
    return Object.values(grouped).sort((a, b) => b.amount - a.amount);
  }, [materials, itemLookup]);

  const labourSummary = useMemo(() => {
    const grouped = {};
    labour.forEach((entry) => {
      const label = entry.contractorName || 'Unknown';
      if (!grouped[label]) grouped[label] = { name: label, amount: 0, entries: 0 };
      grouped[label].amount += Number(entry.amount || 0);
      grouped[label].entries += 1;
    });
    return Object.values(grouped).sort((a, b) => b.amount - a.amount);
  }, [labour]);

  const monthlyTrend = useMemo(() => {
    const grouped = {};

    materials.forEach((entry) => {
      const date = new Date(entry.dateTime);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = { month: key, materials: 0, labour: 0, paymentIn: 0, paymentOut: 0, allocatedExpenses: 0 };
      grouped[key].materials += Number(entry.finalAmount || 0);
    });

    labour.forEach((entry) => {
      const date = new Date(entry.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = { month: key, materials: 0, labour: 0, paymentIn: 0, paymentOut: 0, allocatedExpenses: 0 };
      grouped[key].labour += Number(entry.amount || 0);
    });

    payments.forEach((entry) => {
      const date = new Date(entry.dateTime);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = { month: key, materials: 0, labour: 0, paymentIn: 0, paymentOut: 0, allocatedExpenses: 0 };
      if (entry.paymentType === 'in') {
        grouped[key].paymentIn += Number(entry.amount || 0);
      } else {
        grouped[key].paymentOut += Number(entry.amount || 0);
      }
    });

    allocatedExpenses.forEach((entry) => {
      const date = new Date(entry.dateTime);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = { month: key, materials: 0, labour: 0, paymentIn: 0, paymentOut: 0, allocatedExpenses: 0 };
      grouped[key].allocatedExpenses += Number(entry.allocationAmount || 0);
    });

    return Object.values(grouped)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((item) => ({
        ...item,
        totalCost: item.materials + item.labour + item.paymentOut + item.allocatedExpenses,
        netBalance: item.paymentIn - (item.materials + item.labour + item.paymentOut + item.allocatedExpenses)
      }));
  }, [materials, labour, payments, allocatedExpenses]);

  const totals = useMemo(() => {
    const materialCost = materials.reduce((sum, entry) => sum + Number(entry.finalAmount || 0), 0);
    const labourCost = labour.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const paymentIn = payments
      .filter((entry) => entry.paymentType === 'in')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const paymentOut = payments
      .filter((entry) => entry.paymentType === 'out')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const allocatedExpenseCost = allocatedExpenses.reduce((sum, entry) => sum + Number(entry.allocationAmount || 0), 0);
    const totalCost = materialCost + labourCost + paymentOut + allocatedExpenseCost;

    return {
      materialCost,
      labourCost,
      paymentIn,
      paymentOut,
      allocatedExpenseCost,
      totalCost,
      netBalance: paymentIn - totalCost,
      totalEntries: materials.length + labour.length + payments.length + allocatedExpenses.length
    };
  }, [materials, labour, payments, allocatedExpenses]);

  const exportReport = () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        materialSummary.map((item) => ({
          'Material Name': item.name,
          Entries: item.entries,
          'Total Amount (INR)': item.amount.toFixed(2)
        }))
      ),
      'Material Summary'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        labourSummary.map((item) => ({
          Contractor: item.name,
          Entries: item.entries,
          'Total Amount (INR)': item.amount.toFixed(2)
        }))
      ),
      'Labour Summary'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        monthlyTrend.map((item) => ({
          Month: item.month,
          'Material Cost (INR)': item.materials.toFixed(2),
          'Labour Cost (INR)': item.labour.toFixed(2),
          'Payment In (INR)': item.paymentIn.toFixed(2),
          'Payment Out (INR)': item.paymentOut.toFixed(2),
          'Allocated Expenses (INR)': item.allocatedExpenses.toFixed(2),
          'Total Cost (INR)': item.totalCost.toFixed(2),
          'Net Balance (INR)': item.netBalance.toFixed(2)
        }))
      ),
      'Monthly Trend'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        allocatedExpenses.map((item) => ({
          'Date & Time': new Date(item.dateTime).toLocaleString('en-IN'),
          Expense: item.expenseTitle || '',
          Payee: item.payeeName || '',
          'Allocated Amount (INR)': Number(item.allocationAmount || 0).toFixed(2),
          'Payment Mode': item.allocationPaymentMode || item.paymentMode || '',
          'Cheque Number': item.allocationChequeNumber || '',
          'Cheque Name': item.allocationChequeName || '',
          'Bank Name': item.allocationBankName || '',
          'Cheque Date': item.allocationChequeDate || '',
          Note: item.note || ''
        }))
      ),
      'Allocated Expenses'
    );

    XLSX.writeFile(workbook, `${projectName || 'Project'}_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      <section className="glass-card p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Reports & Analysis</h2>
            <p className="text-sm text-slate-600">{projectName} performance overview and trend insights.</p>
          </div>

          <button type="button" onClick={exportReport} className="orange-btn">
            <Download className="h-4 w-4" />
            Export Full Report
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="glass-card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Cost</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">INR {totals.totalCost.toLocaleString('en-IN')}</p>
          <TrendingUp className="mt-3 h-5 w-5 text-blue-700" />
        </div>
        <div className="glass-card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Material Cost</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">INR {totals.materialCost.toLocaleString('en-IN')}</p>
          <Layers3 className="mt-3 h-5 w-5 text-blue-700" />
        </div>
        <div className="glass-card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Labour Cost</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">INR {totals.labourCost.toLocaleString('en-IN')}</p>
          <Hammer className="mt-3 h-5 w-5 text-blue-700" />
        </div>
        <div className="glass-card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Allocated Expenses</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">INR {totals.allocatedExpenseCost.toLocaleString('en-IN')}</p>
          <ArrowUpCircle className="mt-3 h-5 w-5 text-slate-700" />
        </div>
        <div className="glass-card p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Entries</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totals.totalEntries}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="surface-card border-l-4 border-l-emerald-500 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Payment In</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">INR {totals.paymentIn.toLocaleString('en-IN')}</p>
          <ArrowDownCircle className="mt-3 h-5 w-5 text-emerald-600" />
        </div>
        <div className="surface-card border-l-4 border-l-red-500 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Payment Out</p>
          <p className="mt-1 text-2xl font-semibold text-red-700">INR {totals.paymentOut.toLocaleString('en-IN')}</p>
          <ArrowUpCircle className="mt-3 h-5 w-5 text-red-600" />
        </div>
        <div className={`surface-card border-l-4 p-4 ${totals.netBalance >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
          <p className="text-xs uppercase tracking-wide text-slate-500">Net Balance</p>
          <p className={`mt-1 text-2xl font-semibold ${totals.netBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            INR {totals.netBalance.toLocaleString('en-IN')}
          </p>
          <p className="mt-2 text-xs text-slate-500">Payment In - (Material + Labour + Payment Out + Allocated Expenses)</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="glass-card p-4">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Top Material Spend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={materialSummary.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe5f8" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => `INR ${Number(value).toLocaleString('en-IN')}`} />
              <Bar dataKey="amount" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-4">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Top Contractor Spend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={labourSummary.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe5f8" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => `INR ${Number(value).toLocaleString('en-IN')}`} />
              <Bar dataKey="amount" fill="#1e3a8a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="glass-card p-4">
        <h3 className="mb-3 text-base font-semibold text-slate-900">Monthly Cost vs Net Balance</h3>
        <ResponsiveContainer width="100%" height={330}>
          <LineChart data={monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe5f8" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => `INR ${Number(value).toLocaleString('en-IN')}`} />
            <Legend />
            <Line type="monotone" dataKey="totalCost" stroke="#ef4444" strokeWidth={2} name="Total Cost" />
            <Line type="monotone" dataKey="paymentIn" stroke="#16a34a" strokeWidth={2} name="Payment In" />
            <Line type="monotone" dataKey="allocatedExpenses" stroke="#64748b" strokeWidth={2} name="Allocated Expenses" />
            <Line type="monotone" dataKey="netBalance" stroke="#1d4ed8" strokeWidth={2} name="Net Balance" />
          </LineChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
};

export default Reports;

