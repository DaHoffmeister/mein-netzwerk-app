// lib/crypto/e2eContext.tsx
// React-Kontext für E2E-Status — ob ein Key auf dem Gerät vorhanden ist.

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { hasPrivateKey } from './keyStore';

type E2EContextType = {
  hasKey: boolean;
  isChecking: boolean;
  recheckKey: () => Promise<void>;
};

const E2EContext = createContext<E2EContextType>({
  hasKey: false,
  isChecking: true,
  recheckKey: async () => {},
});

export function E2EProvider({ children }: { children: React.ReactNode }) {
  const [hasKey, setHasKey] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const recheckKey = useCallback(async () => {
    setIsChecking(true);
    const found = await hasPrivateKey();
    setHasKey(found);
    setIsChecking(false);
  }, []);

  useEffect(() => { recheckKey(); }, [recheckKey]);

  return (
    <E2EContext.Provider value={{ hasKey, isChecking, recheckKey }}>
      {children}
    </E2EContext.Provider>
  );
}

export function useE2E() {
  return useContext(E2EContext);
}
