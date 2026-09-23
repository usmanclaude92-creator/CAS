import React from 'react';

export interface MasterDataSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MasterDataSelectGroup {
  label: string;
  options: MasterDataSelectOption[];
}

interface MasterDataSelectProps {
  value: string;
  onChange: (value: string) => void;
  onAddNew: () => void;
  addNewLabel: string;
  options?: MasterDataSelectOption[];
  groups?: MasterDataSelectGroup[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const ADD_NEW_VALUE = '__add_new__';

// Universal master-data picker: a plain <select> that always carries a final
// "+ Add New ..." option, so a user who can't find a record while filling a
// transaction can create it inline instead of abandoning the form. Selecting
// it calls onAddNew() and leaves the bound value untouched (the select is
// controlled, so it snaps back to the real value on the next render) —
// callers open their "New X" modal on top and, once saved, call the
// select's onChange themselves with the newly created record's id.
export const MasterDataSelect: React.FC<MasterDataSelectProps> = ({
  value,
  onChange,
  onAddNew,
  addNewLabel,
  options,
  groups,
  placeholder,
  required,
  disabled,
  id,
  className = 'w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === ADD_NEW_VALUE) {
      onAddNew();
      return;
    }
    onChange(e.target.value);
  };

  return (
    <select
      id={id}
      required={required}
      disabled={disabled}
      value={value}
      onChange={handleChange}
      className={className}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options?.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
      {groups?.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
      <option disabled>──────────</option>
      <option value={ADD_NEW_VALUE} style={{ color: '#2563eb', fontWeight: 600 }}>
        {addNewLabel}
      </option>
    </select>
  );
};

export default MasterDataSelect;
