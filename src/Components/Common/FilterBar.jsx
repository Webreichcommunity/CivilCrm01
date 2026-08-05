import React from 'react';
import { CalendarDays, FilterX } from 'lucide-react';

const FilterBar = ({
  filters,
  setFilters,
  dropdownKey,
  dropdownLabel,
  dropdownOptions = [],
  extraDropdowns = []
}) => {
  const hasActiveFilters = Boolean(
    filters.startDate ||
    filters.endDate ||
    filters[dropdownKey] ||
    extraDropdowns.some((field) => filters[field.key])
  );

  const updateField = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    const resetPayload = {
      startDate: '',
      endDate: '',
      [dropdownKey]: ''
    };

    extraDropdowns.forEach((field) => {
      resetPayload[field.key] = '';
    });

    setFilters((prev) => ({
      ...prev,
      ...resetPayload
    }));
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 backdrop-blur-sm">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => updateField('startDate', event.target.value)}
              className="input-field pl-9"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">End Date</label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => updateField('endDate', event.target.value)}
              className="input-field pl-9"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{dropdownLabel}</label>
          <select value={filters[dropdownKey] || ''} onChange={(event) => updateField(dropdownKey, event.target.value)} className="input-field">
            <option value="">All</option>
            {dropdownOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {extraDropdowns.map((field) => (
          <div key={field.key}>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</label>
            <select value={filters[field.key] || ''} onChange={(event) => updateField(field.key, event.target.value)} className="input-field">
              <option value="">All</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        <div className="flex items-end">
          <button type="button" onClick={clearFilters} disabled={!hasActiveFilters} className="neutral-btn h-[42px] w-full whitespace-nowrap">
            <FilterX className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;

