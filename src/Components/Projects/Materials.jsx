import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { Edit2, List, Plus, Search, Trash2, X } from 'lucide-react';
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

const createInitialMaterialState = () => ({
  categoryName: '',
  subCategoryName: '',
  itemName: '',
  vendorName: '',
  paymentMode: '',
  chequeNumber: '',
  chequeName: '',
  bankName: '',
  chequeDate: '',
  dateTime: getLocalDateTimeInputValue(),
  unit: '',
  perItemPrice: '',
  quantity: '',
  finalAmount: '',
  note: ''
});

const initialItemState = {
  categoryName: '',
  subCategoryName: '',
  name: '',
  unit: '',
  perItemPrice: ''
};

const vendorStorageKey = 'vastushobha_material_vendors';

const getStoredVendors = () => {
  try {
    return JSON.parse(localStorage.getItem(vendorStorageKey) || '[]');
  } catch {
    return [];
  }
};

const saveStoredVendor = (vendorName) => {
  const cleaned = vendorName.trim();
  if (!cleaned) return;

  const vendors = getStoredVendors();
  const nextVendors = [cleaned, ...vendors.filter((name) => name.toLowerCase() !== cleaned.toLowerCase())].slice(0, 80);
  localStorage.setItem(vendorStorageKey, JSON.stringify(nextVendors));
};

const Materials = () => {
  const { projectId } = useParams();
  const [materials, setMaterials] = useState([]);
  const [itemNames, setItemNames] = useState([]);
  const [vendorSuggestions, setVendorSuggestions] = useState(getStoredVendors);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isItemMasterWorkspaceOpen, setIsItemMasterWorkspaceOpen] = useState(false);
  const [draftMaterial, setDraftMaterial] = useState(createInitialMaterialState);
  const [draftItem, setDraftItem] = useState(initialItemState);
  const [editingId, setEditingId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFiltersOnMobile, setShowFiltersOnMobile] = useState(false);

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    itemName: '',
    categoryName: '',
    subCategoryName: '',
    vendorName: '',
    paymentMode: ''
  });

  const loadData = async () => {
    setLoading(true);

    try {
      const [itemSnapshot, materialSnapshot] = await Promise.all([
        getDocs(collection(db, 'itemNames')),
        getDocs(collection(db, `projects/${projectId}/materials`))
      ]);

      const items = itemSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...snapshot.data()
      }));

      const materialEntries = materialSnapshot.docs
        .map((snapshot) => ({
          id: snapshot.id,
          ...snapshot.data()
        }))
        .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

      setItemNames(items);
      setMaterials(materialEntries);
      setVendorSuggestions((prev) => {
        const savedVendors = new Set(prev);
        materialEntries.forEach((entry) => {
          if (entry.vendorName) savedVendors.add(entry.vendorName);
        });
        return [...savedVendors].sort((a, b) => a.localeCompare(b));
      });
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const resetMaterialState = () => {
    setDraftMaterial(createInitialMaterialState());
    setEditingId(null);
  };

  const resetItemState = () => {
    setDraftItem(initialItemState);
    setEditingItemId(null);
  };

  const calculateMaterialAmount = (quantity, price) => {
    const value = Number(quantity || 0) * Number(price || 0);
    return Number.isFinite(value) && value > 0 ? value.toFixed(2) : '';
  };

  const handleSelectItem = (itemId) => {
    const selected = itemNames.find((item) => item.id === itemId);
    const perItemPrice = selected?.perItemPrice || selected?.defaultRate || '';
    setDraftMaterial((prev) => ({
      ...prev,
      categoryName: selected?.categoryName || prev.categoryName || '',
      subCategoryName: selected?.subCategoryName || prev.subCategoryName || '',
      itemName: itemId,
      unit: selected?.unit || '',
      perItemPrice,
      finalAmount: calculateMaterialAmount(prev.quantity, perItemPrice)
    }));
  };

  const handleMaterialCategoryChange = (categoryName) => {
    setDraftMaterial((prev) => ({
      ...prev,
      categoryName,
      subCategoryName: '',
      itemName: '',
      unit: '',
      perItemPrice: '',
      finalAmount: ''
    }));
  };

  const handleMaterialSubCategoryChange = (subCategoryName) => {
    setDraftMaterial((prev) => ({
      ...prev,
      subCategoryName,
      itemName: '',
      unit: '',
      perItemPrice: '',
      finalAmount: ''
    }));
  };

  const handleMaterialQuantityChange = (quantity) => {
    setDraftMaterial((prev) => ({
      ...prev,
      quantity,
      finalAmount: calculateMaterialAmount(quantity, prev.perItemPrice)
    }));
  };

  const handleMaterialPriceChange = (perItemPrice) => {
    setDraftMaterial((prev) => ({
      ...prev,
      perItemPrice,
      finalAmount: calculateMaterialAmount(prev.quantity, perItemPrice)
    }));
  };

  const handleSaveMaterial = async () => {
    if (!draftMaterial.itemName || !draftMaterial.quantity || !draftMaterial.perItemPrice || !draftMaterial.vendorName.trim() || !draftMaterial.paymentMode) {
      alert('Item, vendor, quantity, per item price, and payment mode are required.');
      return;
    }
    if (
      draftMaterial.paymentMode === 'cheque' &&
      (!draftMaterial.chequeNumber.trim() || !draftMaterial.chequeName.trim() || !draftMaterial.bankName.trim() || !draftMaterial.chequeDate)
    ) {
      alert('Cheque number, cheque name, bank name, and cheque date are required for cheque payment mode.');
      return;
    }

    const payload = {
      ...draftMaterial,
      vendorName: draftMaterial.vendorName.trim(),
      categoryName: draftMaterial.categoryName.trim(),
      subCategoryName: draftMaterial.subCategoryName.trim(),
      quantity: Number(draftMaterial.quantity),
      perItemPrice: Number(draftMaterial.perItemPrice),
      finalAmount: Number(draftMaterial.finalAmount),
      chequeNumber: draftMaterial.paymentMode === 'cheque' ? draftMaterial.chequeNumber.trim() : '',
      chequeName: draftMaterial.paymentMode === 'cheque' ? draftMaterial.chequeName.trim() : '',
      bankName: draftMaterial.paymentMode === 'cheque' ? draftMaterial.bankName.trim() : '',
      chequeDate: draftMaterial.paymentMode === 'cheque' ? draftMaterial.chequeDate : '',
      createdAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, `projects/${projectId}/materials`, editingId), payload);
      } else {
        await addDoc(collection(db, `projects/${projectId}/materials`), payload);
      }
      saveStoredVendor(payload.vendorName);
      setVendorSuggestions((prev) => [payload.vendorName, ...prev.filter((name) => name.toLowerCase() !== payload.vendorName.toLowerCase())].sort((a, b) => a.localeCompare(b)));
      setIsMaterialModalOpen(false);
      resetMaterialState();
      loadData();
    } catch (error) {
      console.error('Error saving material:', error);
    }
  };

  const handleEdit = (material) => {
    setDraftMaterial({
      categoryName: material.categoryName || itemLookup[material.itemName]?.categoryName || '',
      subCategoryName: material.subCategoryName || itemLookup[material.itemName]?.subCategoryName || '',
      itemName: material.itemName,
      vendorName: material.vendorName || '',
      paymentMode: material.paymentMode || '',
      chequeNumber: material.chequeNumber || '',
      chequeName: material.chequeName || '',
      bankName: material.bankName || '',
      chequeDate: material.chequeDate || '',
      dateTime: material.dateTime,
      unit: material.unit,
      perItemPrice: material.perItemPrice || '',
      quantity: material.quantity || '',
      finalAmount: material.finalAmount,
      note: material.note || ''
    });
    setEditingId(material.id);
    setIsMaterialModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this material entry?')) return;

    try {
      await deleteDoc(doc(db, `projects/${projectId}/materials`, id));
      loadData();
    } catch (error) {
      console.error('Error deleting material:', error);
    }
  };

  const handleSaveItemMaster = async () => {
    if (!draftItem.categoryName.trim() || !draftItem.subCategoryName.trim() || !draftItem.name.trim() || !draftItem.unit.trim() || !draftItem.perItemPrice) {
      alert('Please fill all item master fields.');
      return;
    }

    try {
      const payload = {
        categoryName: draftItem.categoryName.trim(),
        subCategoryName: draftItem.subCategoryName.trim(),
        name: draftItem.name.trim(),
        unit: draftItem.unit.trim(),
        perItemPrice: Number(draftItem.perItemPrice)
      };

      if (editingItemId) {
        await updateDoc(doc(db, 'itemNames', editingItemId), payload);
      } else {
        await addDoc(collection(db, 'itemNames'), payload);
      }

      setIsItemModalOpen(false);
      resetItemState();
      loadData();
    } catch (error) {
      console.error('Error saving item master:', error);
    }
  };

  const handleEditItemMaster = (item) => {
    setDraftItem({
      categoryName: item.categoryName || '',
      subCategoryName: item.subCategoryName || '',
      name: item.name || '',
      unit: item.unit || '',
      perItemPrice: item.perItemPrice || item.defaultRate || ''
    });
    setEditingItemId(item.id);
    setIsItemModalOpen(true);
  };

  const handleDeleteItemMaster = async (id) => {
    if (!window.confirm('Delete this item master entry?')) return;

    try {
      await deleteDoc(doc(db, 'itemNames', id));
      loadData();
    } catch (error) {
      console.error('Error deleting item master:', error);
    }
  };

  const itemLookup = Object.fromEntries(itemNames.map((item) => [item.id, item]));

  const filterOptions = useMemo(() => {
    const uniqueItemIds = [...new Set(materials.map((entry) => entry.itemName).filter(Boolean))];
    const lookup = Object.fromEntries(itemNames.map((item) => [item.id, item]));
    return uniqueItemIds
      .map((itemId) => ({ value: itemId, label: lookup[itemId]?.name || 'Unknown Item' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [materials, itemNames]);

  const categoryOptions = useMemo(() => {
    const categories = new Set();
    const lookup = Object.fromEntries(itemNames.map((item) => [item.id, item]));
    itemNames.forEach((item) => item.categoryName && categories.add(item.categoryName));
    materials.forEach((entry) => {
      const categoryName = entry.categoryName || lookup[entry.itemName]?.categoryName;
      if (categoryName) categories.add(categoryName);
    });
    return [...categories].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }));
  }, [itemNames, materials]);

  const subCategoryOptions = useMemo(() => {
    const subCategories = new Set();
    const lookup = Object.fromEntries(itemNames.map((item) => [item.id, item]));
    itemNames.forEach((item) => {
      if (!draftMaterial.categoryName || item.categoryName === draftMaterial.categoryName) {
        if (item.subCategoryName) subCategories.add(item.subCategoryName);
      }
    });
    materials.forEach((entry) => {
      const categoryName = entry.categoryName || lookup[entry.itemName]?.categoryName;
      const subCategoryName = entry.subCategoryName || lookup[entry.itemName]?.subCategoryName;
      if ((!draftMaterial.categoryName || categoryName === draftMaterial.categoryName) && subCategoryName) {
        subCategories.add(subCategoryName);
      }
    });
    return [...subCategories].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }));
  }, [draftMaterial.categoryName, itemNames, materials]);

  const filterSubCategoryOptions = useMemo(() => {
    const subCategories = new Set();
    const lookup = Object.fromEntries(itemNames.map((item) => [item.id, item]));
    materials.forEach((entry) => {
      const categoryName = entry.categoryName || lookup[entry.itemName]?.categoryName;
      const subCategoryName = entry.subCategoryName || lookup[entry.itemName]?.subCategoryName;
      if ((!filters.categoryName || categoryName === filters.categoryName) && subCategoryName) {
        subCategories.add(subCategoryName);
      }
    });
    return [...subCategories].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }));
  }, [filters.categoryName, materials, itemNames]);

  const itemMasterCategoryNames = useMemo(() => {
    return [...new Set(itemNames.map((item) => item.categoryName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [itemNames]);

  const itemMasterSubCategoryNames = useMemo(() => {
    return [...new Set(itemNames
      .filter((item) => !draftItem.categoryName || item.categoryName === draftItem.categoryName)
      .map((item) => item.subCategoryName)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }, [draftItem.categoryName, itemNames]);

  const materialItemOptions = useMemo(() => {
    return itemNames
      .filter((item) => !draftMaterial.categoryName || item.categoryName === draftMaterial.categoryName)
      .filter((item) => !draftMaterial.subCategoryName || item.subCategoryName === draftMaterial.subCategoryName)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [draftMaterial.categoryName, draftMaterial.subCategoryName, itemNames]);

  const vendorFilterOptions = useMemo(() => {
    const uniqueVendors = [...new Set(materials.map((entry) => entry.vendorName).filter(Boolean))];
    return uniqueVendors.sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }));
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    const lookup = Object.fromEntries(itemNames.map((item) => [item.id, item]));
    return materials.filter((entry) => {
      const entryDate = new Date(entry.dateTime);
      const startDate = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
      const endDate = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;

      if (startDate && entryDate < startDate) return false;
      if (endDate && entryDate > endDate) return false;
      const entryCategoryName = entry.categoryName || lookup[entry.itemName]?.categoryName || '';
      const entrySubCategoryName = entry.subCategoryName || lookup[entry.itemName]?.subCategoryName || '';
      if (filters.categoryName && entryCategoryName !== filters.categoryName) return false;
      if (filters.subCategoryName && entrySubCategoryName !== filters.subCategoryName) return false;
      if (filters.itemName && entry.itemName !== filters.itemName) return false;
      if (filters.vendorName && entry.vendorName !== filters.vendorName) return false;
      if (filters.paymentMode && entry.paymentMode !== filters.paymentMode) return false;

      if (searchTerm.trim()) {
        const keyword = searchTerm.toLowerCase();
        const itemName = lookup[entry.itemName]?.name?.toLowerCase() || '';
        const categoryName = entryCategoryName.toLowerCase();
        const subCategoryName = entrySubCategoryName.toLowerCase();
        const vendorName = entry.vendorName?.toLowerCase() || '';
        return itemName.includes(keyword) || categoryName.includes(keyword) || subCategoryName.includes(keyword) || vendorName.includes(keyword);
      }

      return true;
    });
  }, [materials, filters, searchTerm, itemNames]);

  const totalAmount = filteredMaterials.reduce((sum, entry) => sum + Number(entry.finalAmount || 0), 0);

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
            <h2 className="text-xl font-semibold text-slate-900">Materials Management</h2>
            <p className="text-sm text-slate-600">Track all material entries with fast filtering and export.</p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setIsItemMasterWorkspaceOpen(true);
              }}
              className="neutral-btn"
            >
              <List className="h-4 w-4" />
              Item Master
            </button>
            <button
              type="button"
              onClick={() => {
                resetMaterialState();
                setIsMaterialModalOpen(true);
              }}
              className="orange-btn"
            >
              <Plus className="h-4 w-4" />
              Add Material Entry
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search Item / Vendor</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="input-field pl-9"
                placeholder="Type item or vendor name"
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
              dropdownKey="itemName"
              dropdownLabel="Material Type"
              dropdownOptions={filterOptions}
              extraDropdowns={[
                {
                  key: 'categoryName',
                  label: 'Category',
                  options: categoryOptions
                },
                {
                  key: 'subCategoryName',
                  label: 'Sub Category',
                  options: filterSubCategoryOptions
                },
                {
                  key: 'vendorName',
                  label: 'Vendor',
                  options: vendorFilterOptions
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
            <ExportButton data={filteredMaterials} itemNames={itemNames} filename="materials_report" type="material" />
          </div>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{filteredMaterials.length}</span> entries | Total filtered amount:{' '}
          <span className="font-semibold text-slate-900">INR {totalAmount.toLocaleString('en-IN')}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Category', 'Sub Category', 'Item', 'Vendor', 'Date & Time', 'Unit', 'Qty', 'Per Item Price', 'Amount', 'Payment Mode', 'Cheque Details', 'Note', 'Actions'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/90">
              {filteredMaterials.map((entry) => (
                <tr key={entry.id} className="hover:bg-blue-50/60">
                  <td className="px-4 py-3 text-sm text-slate-600">{entry.categoryName || itemLookup[entry.itemName]?.categoryName || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{entry.subCategoryName || itemLookup[entry.itemName]?.subCategoryName || '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{itemLookup[entry.itemName]?.name || 'Unknown'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{entry.vendorName || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{new Date(entry.dateTime).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{entry.unit || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{Number(entry.quantity || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">INR {Number(entry.perItemPrice || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">INR {Number(entry.finalAmount || 0).toLocaleString('en-IN')}</td>
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
                      <button type="button" onClick={() => handleEdit(entry)} className="neutral-btn h-8 w-8 border-slate-200 p-0">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDelete(entry.id)} className="neutral-btn h-8 w-8 border-slate-200 p-0 text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filteredMaterials.length && <div className="px-4 py-10 text-center text-sm text-slate-500">No material entries found for selected filters.</div>}
      </section>

      {isItemMasterWorkspaceOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-2 sm:p-4">
          <div className="glass-card h-full w-full overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 md:px-5 md:py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Item Master Workspace</h3>
                <p className="text-sm text-slate-600">Manage all material item masters from one full-page view.</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetItemState();
                    setIsItemModalOpen(true);
                  }}
                  className="orange-btn"
                >
                  <Plus className="h-4 w-4" />
                  Add Item Master
                </button>
                <button type="button" onClick={() => setIsItemMasterWorkspaceOpen(false)} className="neutral-btn">
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>
            </div>

            <div className="h-[calc(100%-84px)] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-sm">
                  <tr>
                    {['Category', 'Sub Category', 'Item Name', 'Unit', 'Per Item Price', 'Actions'].map((head) => (
                      <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white/90">
                  {[...itemNames]
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-blue-50/60">
                        <td className="px-4 py-3 text-sm text-slate-600">{item.categoryName || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.subCategoryName || '-'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.unit}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">INR {Number(item.perItemPrice || item.defaultRate || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => handleEditItemMaster(item)} className="neutral-btn h-8 w-8 border-slate-200 p-0">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItemMaster(item.id)}
                              className="neutral-btn h-8 w-8 border-slate-200 p-0 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {!itemNames.length && <div className="px-4 py-10 text-center text-sm text-slate-500">No item master records yet. Add your first item to begin.</div>}
            </div>
          </div>
        </div>
      )}

      {isMaterialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card max-h-[92vh] w-full max-w-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Material Entry' : 'Add Material Entry'}</h3>
              <button type="button" onClick={() => setIsMaterialModalOpen(false)} className="neutral-btn h-9 w-9 border-none p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
                <select value={draftMaterial.categoryName} onChange={(event) => handleMaterialCategoryChange(event.target.value)} className="input-field">
                  <option value="">All categories</option>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Sub Category</label>
                <select value={draftMaterial.subCategoryName} onChange={(event) => handleMaterialSubCategoryChange(event.target.value)} className="input-field">
                  <option value="">All sub categories</option>
                  {subCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Item Name</label>
                <select value={draftMaterial.itemName} onChange={(event) => handleSelectItem(event.target.value)} className="input-field">
                  <option value="">Select item</option>
                  {materialItemOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Vendor Name</label>
                <input
                  value={draftMaterial.vendorName}
                  onChange={(event) => setDraftMaterial((prev) => ({ ...prev, vendorName: event.target.value }))}
                  className="input-field"
                  list="material-vendor-suggestions"
                  placeholder="Enter vendor name"
                />
                <datalist id="material-vendor-suggestions">
                  {vendorSuggestions.map((vendorName) => (
                    <option key={vendorName} value={vendorName} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Payment Mode</label>
                <select
                  value={draftMaterial.paymentMode}
                  onChange={(event) => setDraftMaterial((prev) => ({ ...prev, paymentMode: event.target.value }))}
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

              {draftMaterial.paymentMode === 'cheque' && (
                <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Cheque Number</label>
                  <input
                    value={draftMaterial.chequeNumber}
                    onChange={(event) => setDraftMaterial((prev) => ({ ...prev, chequeNumber: event.target.value }))}
                    className="input-field"
                    placeholder="Enter cheque number"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Cheque Name</label>
                  <input
                    value={draftMaterial.chequeName}
                    onChange={(event) => setDraftMaterial((prev) => ({ ...prev, chequeName: event.target.value }))}
                    className="input-field"
                    placeholder="Name on cheque"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Bank Name</label>
                  <input
                    value={draftMaterial.bankName}
                    onChange={(event) => setDraftMaterial((prev) => ({ ...prev, bankName: event.target.value }))}
                    className="input-field"
                    placeholder="Bank name"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Cheque Date</label>
                  <input
                    type="date"
                    value={draftMaterial.chequeDate}
                    onChange={(event) => setDraftMaterial((prev) => ({ ...prev, chequeDate: event.target.value }))}
                    className="input-field"
                  />
                </div>
                </>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Date & Time</label>
                <input
                  type="datetime-local"
                  value={draftMaterial.dateTime}
                  onChange={(event) => setDraftMaterial((prev) => ({ ...prev, dateTime: event.target.value }))}
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Unit</label>
                <input value={draftMaterial.unit} readOnly className="input-field bg-slate-100" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={draftMaterial.quantity}
                  onChange={(event) => handleMaterialQuantityChange(event.target.value)}
                  className="input-field"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Per Item Price (INR)</label>
                <input
                  type="number"
                  min="0"
                  value={draftMaterial.perItemPrice}
                  onChange={(event) => handleMaterialPriceChange(event.target.value)}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Total Amount (INR)</label>
                <input
                  value={draftMaterial.finalAmount}
                  readOnly
                  className="input-field bg-slate-100 font-semibold"
                  placeholder="0.00"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Note</label>
                <textarea
                  value={draftMaterial.note}
                  onChange={(event) => setDraftMaterial((prev) => ({ ...prev, note: event.target.value }))}
                  className="input-field min-h-24"
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={() => setIsMaterialModalOpen(false)} className="neutral-btn">
                Cancel
              </button>
              <button type="button" onClick={handleSaveMaterial} className="orange-btn">
                {editingId ? 'Update Entry' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isItemModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="glass-card w-full max-w-md">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{editingItemId ? 'Edit Item Master' : 'Add New Material Item'}</h2>
              <button type="button" onClick={() => setIsItemModalOpen(false)} className="neutral-btn h-9 w-9 border-none p-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
                <input
                  value={draftItem.categoryName}
                  onChange={(event) => setDraftItem((prev) => ({ ...prev, categoryName: event.target.value, subCategoryName: prev.categoryName === event.target.value ? prev.subCategoryName : '' }))}
                  className="input-field"
                  list="material-category-suggestions"
                  placeholder="Cement / Steel / Plumbing"
                />
                <datalist id="material-category-suggestions">
                  {itemMasterCategoryNames.map((categoryName) => (
                    <option key={categoryName} value={categoryName} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Sub Category</label>
                <input
                  value={draftItem.subCategoryName}
                  onChange={(event) => setDraftItem((prev) => ({ ...prev, subCategoryName: event.target.value }))}
                  className="input-field"
                  list="material-subcategory-suggestions"
                  placeholder="OPC / TMT / Fittings"
                />
                <datalist id="material-subcategory-suggestions">
                  {itemMasterSubCategoryNames.map((subCategoryName) => (
                    <option key={subCategoryName} value={subCategoryName} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Item Name</label>
                <input
                  value={draftItem.name}
                  onChange={(event) => setDraftItem((prev) => ({ ...prev, name: event.target.value }))}
                  className="input-field"
                  placeholder="Cement / Steel / Bricks"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Unit</label>
                <input
                  value={draftItem.unit}
                  onChange={(event) => setDraftItem((prev) => ({ ...prev, unit: event.target.value }))}
                  className="input-field"
                  placeholder="Bag / KG / Piece"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Per Item Price (INR)</label>
                <input
                  type="number"
                  min="0"
                  value={draftItem.perItemPrice}
                  onChange={(event) => setDraftItem((prev) => ({ ...prev, perItemPrice: event.target.value }))}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>

            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={() => setIsItemModalOpen(false)} className="neutral-btn">
                Cancel
              </button>
              <button type="button" onClick={handleSaveItemMaster} className="orange-btn">
                {editingItemId ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Materials;

