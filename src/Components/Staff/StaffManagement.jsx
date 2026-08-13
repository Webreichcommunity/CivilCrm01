import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, CalendarDays, Edit2, Plus, Search, Trash2, UserRound, X } from 'lucide-react';
import { db } from '../../Firebase/config';

const createEmptyStaff = () => ({
  name: '',
  position: '',
  salary: '',
  address: '',
  dob: '',
  phone: ''
});

const currentMonthKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthDays = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  const totalDays = new Date(year, month, 0).getDate();
  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      day,
      date,
      weekday: new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })
    };
  });
};

const StaffManagement = () => {
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [draftStaff, setDraftStaff] = useState(createEmptyStaff);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffSnapshot, attendanceSnapshot] = await Promise.all([
        getDocs(collection(db, 'staff')),
        getDocs(collection(db, 'staffAttendance'))
      ]);
      const staffList = staffSnapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const attendanceList = attendanceSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      setStaff(staffList);
      setAttendance(attendanceList);
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const filteredStaff = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return staff;
    return staff.filter((member) =>
      member.name?.toLowerCase().includes(keyword) ||
      member.position?.toLowerCase().includes(keyword) ||
      member.phone?.toLowerCase().includes(keyword)
    );
  }, [staff, searchTerm]);

  const monthDays = useMemo(() => getMonthDays(selectedMonth), [selectedMonth]);

  const attendanceByStaffDate = useMemo(() => {
    return attendance.reduce((accumulator, entry) => {
      accumulator[`${entry.staffId}_${entry.date}`] = entry.status;
      return accumulator;
    }, {});
  }, [attendance]);

  const getMonthlySummary = (staffId) => {
    const monthRows = attendance.filter((entry) => entry.staffId === staffId && entry.monthKey === selectedMonth);
    return {
      present: monthRows.filter((entry) => entry.status === 'present').length,
      absent: monthRows.filter((entry) => entry.status === 'absent').length
    };
  };

  const openCreateModal = () => {
    setDraftStaff(createEmptyStaff());
    setEditingId(null);
    setIsModalOpen(true);
  };

  const editStaff = (member) => {
    setDraftStaff({
      name: member.name || '',
      position: member.position || '',
      salary: member.salary || '',
      address: member.address || '',
      dob: member.dob || '',
      phone: member.phone || ''
    });
    setEditingId(member.id);
    setIsModalOpen(true);
  };

  const saveStaff = async () => {
    if (!draftStaff.name.trim() || !draftStaff.position.trim()) {
      alert('Staff name and position are required.');
      return;
    }

    const payload = {
      name: draftStaff.name.trim(),
      position: draftStaff.position.trim(),
      salary: Number(draftStaff.salary || 0),
      address: draftStaff.address.trim(),
      dob: draftStaff.dob,
      phone: draftStaff.phone.trim(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'staff', editingId), payload);
      } else {
        await addDoc(collection(db, 'staff'), { ...payload, createdAt: new Date().toISOString() });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setDraftStaff(createEmptyStaff());
      loadData();
    } catch (error) {
      console.error('Error saving staff:', error);
    }
  };

  const removeStaff = async (staffId) => {
    if (!window.confirm('Delete this staff member?')) return;
    try {
      await deleteDoc(doc(db, 'staff', staffId));
      loadData();
    } catch (error) {
      console.error('Error deleting staff:', error);
    }
  };

  const toggleAttendance = async (staffId, date) => {
    const key = `${staffId}_${date}`;
    const currentStatus = attendanceByStaffDate[key];
    const nextStatus = currentStatus === 'present' ? 'absent' : 'present';
    const payload = {
      staffId,
      date,
      monthKey: date.slice(0, 7),
      status: nextStatus,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'staffAttendance', key), payload);
      setAttendance((prev) => {
        const remaining = prev.filter((entry) => entry.id !== key);
        return [...remaining, { id: key, ...payload }];
      });
    } catch (error) {
      console.error('Error updating attendance:', error);
    }
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
            <h2 className="text-xl font-semibold text-slate-900">Staff Management</h2>
            <p className="text-sm text-slate-600">Manage staff records and month-wise attendance calendars.</p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button type="button" onClick={() => navigate('/')} className="neutral-btn">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>
            <button type="button" onClick={openCreateModal} className="orange-btn">
              <Plus className="h-4 w-4" />
              Add Staff
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="input-field pl-9"
                placeholder="Name, position, phone"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Month</label>
            <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="input-field" />
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        {filteredStaff.map((member) => {
          const summary = getMonthlySummary(member.id);
          return (
            <article key={member.id} className="surface-card overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{member.name}</h3>
                    <p className="text-sm text-slate-600">{member.position || '-'} | Phone: {member.phone || '-'}</p>
                    <p className="mt-1 text-xs text-slate-500">Salary: INR {Number(member.salary || 0).toLocaleString('en-IN')} | DOB: {member.dob || '-'} | Address: {member.address || '-'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Present: <span className="font-semibold">{summary.present}</span>
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    Absent: <span className="font-semibold">{summary.absent}</span>
                  </div>
                  <button type="button" onClick={() => editStaff(member)} className="neutral-btn h-9 w-9 border-slate-200 p-0">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => removeStaff(member.id)} className="neutral-btn h-9 w-9 border-slate-200 p-0 text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CalendarDays className="h-4 w-4 text-blue-700" />
                  Attendance Calendar
                </div>
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {monthDays.map((day) => {
                    const status = attendanceByStaffDate[`${member.id}_${day.date}`];
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => toggleAttendance(member.id, day.date)}
                        className={`min-h-[58px] rounded-lg border px-1.5 py-1 text-center text-xs transition ${
                          status === 'present'
                            ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                            : status === 'absent'
                              ? 'border-red-300 bg-red-100 text-red-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                        title={`${day.date} ${status || 'not marked'}`}
                      >
                        <span className="block font-semibold">{day.day}</span>
                        <span className="block text-[10px]">{day.weekday}</span>
                        <span className="mt-0.5 block text-[10px] font-semibold uppercase">{status === 'present' ? 'P' : status === 'absent' ? 'A' : '-'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}

        {!filteredStaff.length && (
          <div className="surface-card py-12 text-center text-sm text-slate-500">
            No staff records found. Add staff to start attendance tracking.
          </div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Staff' : 'Add Staff'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="neutral-btn h-9 w-9 border-none p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                <input value={draftStaff.name} onChange={(event) => setDraftStaff((prev) => ({ ...prev, name: event.target.value }))} className="input-field" placeholder="Staff name" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Position</label>
                <input value={draftStaff.position} onChange={(event) => setDraftStaff((prev) => ({ ...prev, position: event.target.value }))} className="input-field" placeholder="Supervisor / Accountant" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Salary (INR)</label>
                <input type="number" min="0" value={draftStaff.salary} onChange={(event) => setDraftStaff((prev) => ({ ...prev, salary: event.target.value }))} className="input-field" placeholder="0" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Phone Number</label>
                <input value={draftStaff.phone} onChange={(event) => setDraftStaff((prev) => ({ ...prev, phone: event.target.value }))} className="input-field" placeholder="Phone number" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">DOB</label>
                <input type="date" value={draftStaff.dob} onChange={(event) => setDraftStaff((prev) => ({ ...prev, dob: event.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Address</label>
                <input value={draftStaff.address} onChange={(event) => setDraftStaff((prev) => ({ ...prev, address: event.target.value }))} className="input-field" placeholder="Address" />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="neutral-btn">
                Cancel
              </button>
              <button type="button" onClick={saveStaff} className="orange-btn">
                {editingId ? 'Update Staff' : 'Save Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
