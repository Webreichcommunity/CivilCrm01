import React, { useState } from 'react';
import { X } from 'lucide-react';

const AddItemModal = ({ isOpen, onClose, onAdd }) => {
  const [itemData, setItemData] = useState({
    name: '',
    unit: '',
    amount: ''
  });

  const handleSubmit = () => {
    if (!itemData.name || !itemData.unit || !itemData.amount) {
      alert('Please fill all fields');
      return;
    }

    onAdd(itemData);
    setItemData({ name: '', unit: '', amount: '' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="glass-card w-full max-w-md">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Add New Material Item</h2>
          <button type="button" onClick={onClose} className="neutral-btn h-9 w-9 border-none p-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Item Name</label>
            <input
              value={itemData.name}
              onChange={(event) => setItemData((prev) => ({ ...prev, name: event.target.value }))}
              className="input-field"
              placeholder="Cement / Steel / Bricks"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Unit</label>
            <input
              value={itemData.unit}
              onChange={(event) => setItemData((prev) => ({ ...prev, unit: event.target.value }))}
              className="input-field"
              placeholder="Bag / KG / Piece"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Default Rate (INR)</label>
            <input
              type="number"
              value={itemData.amount}
              onChange={(event) => setItemData((prev) => ({ ...prev, amount: event.target.value }))}
              className="input-field"
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">
          <button type="button" onClick={onClose} className="neutral-btn">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} className="orange-btn">
            Add Item
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddItemModal;

