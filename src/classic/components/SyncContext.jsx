import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

const SyncContext = createContext();
const USER_DATA_ENDPOINT = '/api/user-data';

function sameStoredValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function requestUserData(user, method, data) {
  const token = await user.getIdToken();
  const response = await fetch(USER_DATA_ENDPOINT, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method === 'PUT' ? { body: JSON.stringify({ data }) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'The study data could not be synchronised.');
  return payload;
}

export function SyncProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const dataRef = useRef(null);
  const writeQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    dataRef.current = null;
    writeQueueRef.current = Promise.resolve();

    if (!user) {
      setData(null);
      return undefined;
    }

    setData(null);
    requestUserData(user, 'GET')
      .then((payload) => {
        if (cancelled) return;
        const remoteData = payload?.data && typeof payload.data === 'object' ? payload.data : {};
        dataRef.current = remoteData;
        setData(remoteData);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Could not load synced study data:', error);
        dataRef.current = {};
        setData({});
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateRemoteFields = useCallback((patch) => {
    if (!user || !patch || Object.keys(patch).length === 0) return Promise.resolve();

    const currentData = dataRef.current || {};
    const changedPatch = Object.fromEntries(
      Object.entries(patch).filter(([key, value]) => !sameStoredValue(currentData[key], value)),
    );
    if (Object.keys(changedPatch).length === 0) return Promise.resolve();

    const nextData = { ...currentData, ...changedPatch };
    dataRef.current = nextData;
    setData(nextData);

    const queuedWrite = writeQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const saved = await requestUserData(user, 'PUT', nextData);
        const savedData = saved?.data && typeof saved.data === 'object' ? saved.data : nextData;
        dataRef.current = savedData;
        setData(savedData);
        return savedData;
      });
    writeQueueRef.current = queuedWrite;
    return queuedWrite;
  }, [user]);

  const updateRemote = useCallback(
    (key, value) => updateRemoteFields({ [key]: value }),
    [updateRemoteFields],
  );

  return (
    <SyncContext.Provider value={{ data, updateRemote, updateRemoteFields }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => useContext(SyncContext);
