import React, { createContext, useContext, useState, useEffect } from 'react';

export type TableDensity = 'comfortable' | 'compact';

interface TableDensityContextType {
  density: TableDensity;
  setDensity: (density: TableDensity) => void;
  toggleDensity: () => void;
  isCompact: boolean;
  cellPadding: string;
  headerPadding: string;
  fontSize: string;
}

const STORAGE_KEY = 'artify_table_density_pref';

const TableDensityContext = createContext<TableDensityContextType>({
  density: 'comfortable',
  setDensity: () => {},
  toggleDensity: () => {},
  isCompact: false,
  cellPadding: 'py-3 px-4',
  headerPadding: 'py-3 px-4',
  fontSize: 'text-xs',
});

export const TableDensityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [density, setDensityState] = useState<TableDensity>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'comfortable' || stored === 'compact') {
        return stored;
      }
    } catch {
      // ignore
    }
    return 'comfortable';
  });

  const setDensity = (newDensity: TableDensity) => {
    setDensityState(newDensity);
    try {
      localStorage.setItem(STORAGE_KEY, newDensity);
    } catch {
      // ignore
    }
  };

  const toggleDensity = () => {
    setDensity(density === 'comfortable' ? 'compact' : 'comfortable');
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-table-density', density);
  }, [density]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'comfortable' || e.newValue === 'compact')) {
        setDensityState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const isCompact = density === 'compact';
  const cellPadding = isCompact ? 'py-1.5 px-3' : 'py-3 px-4';
  const headerPadding = isCompact ? 'py-2 px-3' : 'py-3 px-4';
  const fontSize = isCompact ? 'text-[11px]' : 'text-xs';

  return (
    <TableDensityContext.Provider
      value={{
        density,
        setDensity,
        toggleDensity,
        isCompact,
        cellPadding,
        headerPadding,
        fontSize,
      }}
    >
      {children}
    </TableDensityContext.Provider>
  );
};

export const useTableDensity = () => useContext(TableDensityContext);
export default TableDensityProvider;
