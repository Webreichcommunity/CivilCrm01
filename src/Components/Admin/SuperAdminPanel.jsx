import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import {
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck,
  HandCoins,
  Lock,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
  UsersRound
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { db } from '../../Firebase/config';
import { formatCurrency, getAllocatedExpenseTotalForProject } from '../../utils/projectFinance';

const SUPER_ADMIN_PASSWORD = 'admin123';

const monthKeyFromDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const addGroupedAmount = (grouped, key, field, amount) => {
  if (!grouped[key]) grouped[key] = { month: key, paymentIn: 0, material: 0, labour: 0, directOut: 0, other: 0 };
  grouped[key][field] += Number(amount || 0);
};

const SuperAdminPanel = () => {
  const navigate = useNavigate();
  const [isUnlocked, setIsUnlocked] = useState(() => sessionStorage.getItem('vastushobha_super_admin') === 'unlocked');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [projectRows, setProjectRows] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const unlockPanel = () => {
    if (password !== SUPER_ADMIN_PASSWORD) {
      setError('Incorrect password.');
      return;
    }
    sessionStorage.setItem('vastushobha_super_admin', 'unlocked');
    setIsUnlocked(true);
    setError('');
  };

  useEffect(() => {
    if (!isUnlocked) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [projectSnapshot, expenseSnapshot, staffSnapshot, attendanceSnapshot] = await Promise.all([
          getDocs(collection(db, 'projects')),
          getDocs(collection(db, 'expenses')),
          getDocs(collection(db, 'staff')),
          getDocs(collection(db, 'staffAttendance'))
        ]);

        const projectList = projectSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        const expenseList = expenseSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        const rows = await Promise.all(
          projectList.map(async (project) => {
            const [materialSnapshot, labourSnapshot, paymentSnapshot] = await Promise.all([
              getDocs(collection(db, `projects/${project.id}/materials`)),
              getDocs(collection(db, `projects/${project.id}/labour`)),
              getDocs(collection(db, `projects/${project.id}/payments`))
            ]);

            const materials = materialSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
            const labour = labourSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
            const payments = paymentSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
            const materialCost = materials.reduce((sum, entry) => sum + Number(entry.finalAmount || 0), 0);
            const labourCost = labour.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
            const paymentIn = payments.filter((entry) => entry.paymentType === 'in').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
            const directOut = payments.filter((entry) => entry.paymentType === 'out').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
            const allocatedOther = getAllocatedExpenseTotalForProject(expenseList, project.id);

            return {
              ...project,
              materials,
              labour,
              payments,
              materialCost,
              labourCost,
              paymentIn,
              directOut,
              allocatedOther,
              totalOut: materialCost + labourCost + directOut + allocatedOther,
              balance: paymentIn - (materialCost + labourCost + directOut + allocatedOther)
            };
          })
        );

        setProjectRows(rows.sort((a, b) => (b.totalOut || 0) - (a.totalOut || 0)));
        setExpenses(expenseList);
        setStaff(staffSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
        setAttendance(attendanceSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
      } catch (loadError) {
        console.error('Error loading super admin report:', loadError);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isUnlocked]);

  const overview = useMemo(() => {
    const materialCost = projectRows.reduce((sum, project) => sum + Number(project.materialCost || 0), 0);
    const labourCost = projectRows.reduce((sum, project) => sum + Number(project.labourCost || 0), 0);
    const paymentIn = projectRows.reduce((sum, project) => sum + Number(project.paymentIn || 0), 0);
    const directOut = projectRows.reduce((sum, project) => sum + Number(project.directOut || 0), 0);
    const otherExpenses = expenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const salaryCommitment = staff.reduce((sum, member) => sum + Number(member.salary || 0), 0);
    const totalOut = materialCost + labourCost + directOut + otherExpenses;

    return {
      projectCount: projectRows.length,
      staffCount: staff.length,
      paymentIn,
      materialCost,
      labourCost,
      directOut,
      otherExpenses,
      salaryCommitment,
      totalOut,
      balance: paymentIn - totalOut
    };
  }, [projectRows, expenses, staff]);

  const monthlyTrend = useMemo(() => {
    const grouped = {};

    projectRows.forEach((project) => {
      project.materials?.forEach((entry) => addGroupedAmount(grouped, monthKeyFromDate(entry.dateTime), 'material', entry.finalAmount));
      project.labour?.forEach((entry) => addGroupedAmount(grouped, monthKeyFromDate(entry.date), 'labour', entry.amount));
      project.payments?.forEach((entry) => {
        addGroupedAmount(grouped, monthKeyFromDate(entry.dateTime), entry.paymentType === 'in' ? 'paymentIn' : 'directOut', entry.amount);
      });
    });

    expenses.forEach((entry) => addGroupedAmount(grouped, monthKeyFromDate(entry.dateTime), 'other', entry.amount));

    return Object.values(grouped)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((entry) => ({
        ...entry,
        totalOut: entry.material + entry.labour + entry.directOut + entry.other,
        balance: entry.paymentIn - (entry.material + entry.labour + entry.directOut + entry.other)
      }));
  }, [projectRows, expenses]);

  const payeeSummary = useMemo(() => {
    const grouped = {};
    const addPayee = (name, type, amount) => {
      const key = `${type || 'other'}_${name || 'Unknown'}`;
      if (!grouped[key]) grouped[key] = { name: name || 'Unknown', type: type || 'other', amount: 0, entries: 0 };
      grouped[key].amount += Number(amount || 0);
      grouped[key].entries += 1;
    };

    expenses.forEach((entry) => {
      if (entry.payeeMode === 'multiple' && entry.payees?.length) {
        entry.payees.forEach((payee) => addPayee(payee.payeeName, payee.payeeType, payee.amount));
      } else {
        addPayee(entry.payeeName, entry.payeeType, entry.amount);
      }
    });

    return Object.values(grouped).sort((a, b) => b.amount - a.amount).slice(0, 8);
  }, [expenses]);

  const attendanceSummary = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const rows = attendance.filter((entry) => entry.monthKey === currentMonth);
    return {
      present: rows.filter((entry) => entry.status === 'present').length,
      absent: rows.filter((entry) => entry.status === 'absent').length
    };
  }, [attendance]);

  if (!isUnlocked) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
        <section className="glass-card w-full p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Super Admin</h1>
              <p className="text-sm text-slate-600">Enter password to open business reports.</p>
            </div>
          </div>

          <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && unlockPanel()}
            className="input-field"
            placeholder="Enter password"
            autoFocus
          />
          {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => navigate('/')} className="neutral-btn flex-1">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>
            <button type="button" onClick={unlockPanel} className="orange-btn flex-1">
              <ShieldCheck className="h-4 w-4" />
              Unlock
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700" />
      </div>
    );
  }

  const statCards = [
    { title: 'Projects', value: overview.projectCount, icon: BriefcaseBusiness, tone: 'text-blue-700' },
    { title: 'Payment Received', value: formatCurrency(overview.paymentIn), icon: HandCoins, tone: 'text-emerald-700' },
    { title: 'Total Outflow', value: formatCurrency(overview.totalOut), icon: TrendingUp, tone: 'text-red-700' },
    { title: 'Business Balance', value: formatCurrency(overview.balance), icon: BarChart3, tone: overview.balance >= 0 ? 'text-emerald-700' : 'text-red-700' },
    { title: 'Staff', value: overview.staffCount, icon: UsersRound, tone: 'text-slate-700' },
    { title: 'Monthly Salary', value: formatCurrency(overview.salaryCommitment), icon: CalendarCheck, tone: 'text-blue-700' }
  ];

  return (
    <div className="space-y-4">
      <section className="surface-card p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Super Admin Overview</h1>
            <p className="text-sm text-slate-600">Private Vastushobha business summary, reports, and project performance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate('/')} className="neutral-btn">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem('vastushobha_super_admin');
                setIsUnlocked(false);
                setPassword('');
              }}
              className="neutral-btn"
            >
              <Lock className="h-4 w-4" />
              Lock
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {statCards.map((card) => (
          <div key={card.title} className="surface-card p-4">
            <card.icon className={`h-5 w-5 ${card.tone}`} />
            <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">{card.title}</p>
            <p className={`mt-1 break-words text-xl font-semibold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="surface-card p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Monthly Business Trend</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe5f8" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="paymentIn" fill="#16a34a" name="Payment In" radius={[4, 4, 0, 0]} />
              <Bar dataKey="material" fill="#1d4ed8" name="Material" radius={[4, 4, 0, 0]} />
              <Bar dataKey="labour" fill="#0f172a" name="Labour" radius={[4, 4, 0, 0]} />
              <Bar dataKey="other" fill="#f97316" name="Other Expenses" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="surface-card p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Spend Breakdown</h2>
          <div className="space-y-3">
            {[
              ['Material Spend', overview.materialCost],
              ['Labour Spend', overview.labourCost],
              ['Direct Payment Out', overview.directOut],
              ['Other Expenses', overview.otherExpenses],
              ['Current Month Present Marks', attendanceSummary.present],
              ['Current Month Absent Marks', attendanceSummary.absent]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold text-slate-900">{typeof value === 'number' && label.includes('Spend') || label.includes('Out') || label.includes('Expenses') ? formatCurrency(value) : value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Project Report</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Project', 'Client', 'Payment In', 'Material', 'Labour', 'Direct Out', 'Other', 'Balance'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/90">
              {projectRows.map((project) => (
                <tr key={project.id} className="hover:bg-blue-50/60">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{project.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{project.clientName || '-'}</td>
                  <td className="px-4 py-3 text-sm text-emerald-700">{formatCurrency(project.paymentIn)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(project.materialCost)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(project.labourCost)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(project.directOut)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(project.allocatedOther)}</td>
                  <td className={`px-4 py-3 text-sm font-semibold ${project.balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(project.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="surface-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <ReceiptText className="h-4 w-4 text-blue-700" />
            <h2 className="text-base font-semibold text-slate-900">Top Other Expense Payees</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {payeeSummary.map((payee) => (
              <div key={`${payee.type}-${payee.name}`} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{payee.name}</p>
                  <p className="capitalize text-slate-500">{payee.type} | {payee.entries} entries</p>
                </div>
                <p className="font-semibold text-slate-900">{formatCurrency(payee.amount)}</p>
              </div>
            ))}
            {!payeeSummary.length && <p className="px-4 py-8 text-center text-sm text-slate-500">No expense payees yet.</p>}
          </div>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <UsersRound className="h-4 w-4 text-blue-700" />
            <h2 className="text-base font-semibold text-slate-900">Staff Salary Register</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {staff.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{member.name}</p>
                  <p className="text-slate-500">{member.position || '-'} | {member.phone || '-'}</p>
                </div>
                <p className="font-semibold text-slate-900">{formatCurrency(member.salary)}</p>
              </div>
            ))}
            {!staff.length && <p className="px-4 py-8 text-center text-sm text-slate-500">No staff records yet.</p>}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SuperAdminPanel;
