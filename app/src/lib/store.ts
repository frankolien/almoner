import { useCallback, useEffect, useState } from 'react';

// All bigints are stored as decimal strings so the registration table survives
// JSON serialization to localStorage. The three surfaces share this state, which
// models the org's registration table being handed to beneficiaries + auditor.

export interface StoredRecord {
  secret: string;
  nullifier: string;
  regionCode: string;
  programTier: string;
  birthYear: string;
  kycFlag: string;
  entitlement: string;
  name: string; // demo-only label
}

export interface ProgramMeta {
  programId: string;
  allowedRegion: string;
  regionLabel: string;
  minBirthYear: string;
  requiredTier: string;
  entitlement: string;
}

export interface ClaimRecord {
  leafIndex: number;
  nullifierHash: string;
  recipient: string;
  recipientSecret?: string;
  amount: string;
  txHash?: string;
  at: number;
}

export interface DemoState {
  program: ProgramMeta | null;
  records: StoredRecord[];
  root: string | null;
  createdOnChain: boolean;
  fundedAmount: string;
  claims: ClaimRecord[];
}

const KEY = 'almoner:v1';

const EMPTY: DemoState = {
  program: null,
  records: [],
  root: null,
  createdOnChain: false,
  fundedAmount: '0',
  claims: [],
};

function read(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as DemoState) };
  } catch {
    return EMPTY;
  }
}

// Cross-tab/cross-surface reactive store over localStorage.
export function useDemoStore() {
  const [state, setState] = useState<DemoState>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setState(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((patch: Partial<DemoState> | ((s: DemoState) => DemoState)) => {
    setState((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(KEY);
    setState(EMPTY);
  }, []);

  return { state, update, reset };
}

export type DemoStore = ReturnType<typeof useDemoStore>;
