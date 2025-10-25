import React, { useState, useCallback, useRef } from 'react';
import { api } from '../api';
import * as XLSX from 'xlsx';

interface CSVItem {
  sku: string;
  name: string;
  category: string;
  metal: string;
  purity: string;
  weight_unit: string;
  weight?: number;
  price?: number;
  description?: string;
  gemstones?: string;
  color?: string;
  style?: string;
  tags?: string;
  brand?: string;
  sub_category?: string;
  status?: string;
}

interface CsvImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ onClose, onSuccess }) => {
  const [csvData, setCsvData] = useState<CSVItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [importProgress, setImportProgress] = useState<{ completed: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((data: ArrayBuffer | string, isExcel: boolean): CSVItem[] => {
    let rows: any[] = [];
    let headers: string[] = [];

    if (isExcel) {
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
    } else {
      const text = data as string;
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('File must have at least a header row and one data row');
      }
      rows = lines.map(line => line.split(',').map(v => v.trim()));
    }

    if (rows.length < 2) {
      throw new Error('File must have at least a header row and one data row');
    }

    headers = (rows[0] as string[]).map(h => (h || '').toLowerCase().trim());
    const requiredFields = ['sku', 'name', 'category', 'metal', 'purity', 'weight_unit'];
    const missingFields = requiredFields.filter(f => !headers.includes(f));
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required columns: ${missingFields.join(', ')}`);
    }

    const items: CSVItem[] = [];
    for (let i = 1; i < rows.length; i++) {
      const values = (rows[i] as any[]) || [];
      if (values.every(v => !v || v === '')) continue;

      const item: CSVItem = {
        sku: '',
        name: '',
        category: '',
        metal: '',
        purity: '',
        weight_unit: '',
      };

      headers.forEach((header, idx) => {
        const value = values[idx];
        if (header === 'weight' || header === 'price') {
          if (value) {
            (item as any)[header] = parseFloat(value);
          }
        } else {
          (item as any)[header] = value || '';
        }
      });

      if (item.sku && item.name && item.category && item.metal && item.purity && item.weight_unit) {
        items.push(item);
      }
    }

    if (items.length === 0) {
      throw new Error('No valid items found in file');
    }

    return items;
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isCsv = file.name.endsWith('.csv');

    if (!isExcel && !isCsv) {
      setError('Please upload a CSV or Excel (.xlsx) file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) throw new Error('Failed to read file');
        const items = parseFile(data as ArrayBuffer | string, isExcel);
        setCsvData(items);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file');
        setCsvData([]);
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  }, [parseFile]);

  const handleImport = useCallback(async () => {
    if (csvData.length === 0) {
      setError('No data to import');
      return;
    }

    setIsLoading(true);
    setError('');
    setImportProgress({ completed: 0, total: csvData.length });

    try {
      const response = await api.post('/inventory/items/import', {
        items: csvData
      });

      if (response.data.success || response.data.imported > 0) {
        setImportProgress({ completed: csvData.length, total: csvData.length });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000);
      } else {
        setError(response.data.message || 'Import failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [csvData, onSuccess, onClose]);

  const downloadTemplate = useCallback(() => {
    const headers = [
      'sku',
      'name',
      'category',
      'metal',
      'purity',
      'weight_unit',
      'weight',
      'price',
      'description',
      'gemstones',
      'color',
      'style',
      'tags',
      'brand',
      'sub_category',
      'status'
    ];
    const template = [
      headers.join(','),
      'GR001,Diamond Gold Ring,Rings,Gold,22K,g,5.5,45000,Beautiful diamond ring,Diamond,Yellow Gold,Modern,luxury;handcrafted,Smart Jewel,Wedding,active'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'items_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Import Products from CSV or Excel</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!csvData.length ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>Required columns:</strong> sku, name, category, metal, purity, weight_unit
                  </p>
                  <p className="text-sm text-blue-700">
                    <strong>Optional columns:</strong> weight, price, description, gemstones, color, style, tags, brand, sub_category, status
                  </p>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
                  </svg>
                  <p className="text-gray-600 mb-2">Drag and drop your CSV or Excel file here, or click to browse</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Select CSV or Excel File
                  </button>
                </div>

                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                >
                  Download CSV Template
                </button>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {importProgress && importProgress.completed === importProgress.total ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="text-green-800 font-medium">✓ Successfully imported {csvData.length} items!</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">Preview of {csvData.length} items to import:</p>
                    
                    <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Metal</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Purity</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {csvData.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-2">{item.sku}</td>
                              <td className="px-4 py-2">{item.name}</td>
                              <td className="px-4 py-2">{item.category}</td>
                              <td className="px-4 py-2">{item.metal}</td>
                              <td className="px-4 py-2">{item.purity}</td>
                              <td className="px-4 py-2">{item.weight ? `${item.weight}${item.weight_unit}` : '-'}</td>
                              <td className="px-4 py-2">₹{item.price?.toLocaleString() || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-red-800 text-sm">{error}</p>
                      </div>
                    )}

                    {importProgress && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${(importProgress.completed / importProgress.total) * 100}%` }}
                          ></div>
                        </div>
                        <p className="text-sm text-blue-800 mt-2">Importing... {importProgress.completed}/{importProgress.total}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            {csvData.length > 0 && (!importProgress || importProgress.completed !== importProgress.total) ? (
              <>
                <button
                  onClick={handleImport}
                  disabled={isLoading}
                  className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {isLoading ? 'Importing...' : 'Import Items'}
                </button>
                <button
                  onClick={() => { setCsvData([]); setError(''); }}
                  className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Back
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
