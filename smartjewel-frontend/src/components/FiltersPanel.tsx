import React, { useEffect, useState } from 'react';

export interface FiltersState {
  min_price?: number;
  max_price?: number;
  min_weight?: number;
  max_weight?: number;
  metal?: string[];
  purity?: string[];
}

interface Props {
  value: FiltersState;
  onChange: (next: FiltersState) => void;
  onApply?: () => void;
}

const METALS = ['Gold','Silver','Platinum','Diamond'];
const PURITIES = ['24K','22K','18K','14K'];

export const FiltersPanel: React.FC<Props> = ({ value, onChange, onApply }) => {
  const [local, setLocal] = useState<FiltersState>(value);

  useEffect(()=>{ setLocal(value); }, [value]);

  const update = (patch: Partial<FiltersState>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange(next);
  };

  const toggleInArray = (key: 'metal' | 'purity', val: string) => {
    const arr = new Set([...(local[key] || [])]);
    if (arr.has(val)) arr.delete(val); else arr.add(val);
    update({ [key]: Array.from(arr) } as Partial<FiltersState>);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-gray-700 mb-2">Price (₹)</div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" inputMode="numeric" placeholder="Min" className="input"
            value={local.min_price ?? ''}
            onChange={e => update({ min_price: e.target.value ? Number(e.target.value) : undefined })}
          />
          <input type="number" inputMode="numeric" placeholder="Max" className="input"
            value={local.max_price ?? ''}
            onChange={e => update({ max_price: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-gray-700 mb-2">Weight (g)</div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" inputMode="numeric" placeholder="Min" className="input"
            value={local.min_weight ?? ''}
            onChange={e => update({ min_weight: e.target.value ? Number(e.target.value) : undefined })}
          />
          <input type="number" inputMode="numeric" placeholder="Max" className="input"
            value={local.max_weight ?? ''}
            onChange={e => update({ max_weight: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-gray-700 mb-2">Metal</div>
        <div className="flex flex-wrap gap-2">
          {METALS.map(m => (
            <button key={m}
              onClick={()=>toggleInArray('metal', m)}
              className={`px-3 py-1.5 rounded-full border text-sm ${local.metal?.includes(m) ? 'bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >{m}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-gray-700 mb-2">Purity</div>
        <div className="flex flex-wrap gap-2">
          {PURITIES.map(p => (
            <button key={p}
              onClick={()=>toggleInArray('purity', p)}
              className={`px-3 py-1.5 rounded-full border text-sm ${local.purity?.includes(p) ? 'bg-gray-900 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >{p}</button>
          ))}
        </div>
      </div>

      {onApply && (
        <div className="pt-2">
          <button onClick={onApply} className="w-full px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700">Apply Filters</button>
        </div>
      )}
    </div>
  );
};

export default FiltersPanel;
