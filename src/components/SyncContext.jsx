import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { loadUserData, requestUserData } from '../utils/portalUserSync';

const SyncContext = createContext();

function sameStoredValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function SyncProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const dataRef = useRef(null);
  const writeQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    dataRef.current = null;
    writeQueueRef.current = Promise.resolve();

    if (!user) {
      setData(null);
      setSyncError(null);
      return undefined;
    }

    setData(null);
    setSyncError(null);
    loadUserData(user)
      .then((remoteData) => {
        if (cancelled) return;
        dataRef.current = remoteData;
        setData(remoteData);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Could not load synced study data:', error);
        // Do not treat a failed read as an empty account: that can overwrite
        // existing study data when the portal next sends its local cache.
        setSyncError('Study data is not syncing. Your changes remain on this device.');
      });

    return () => {
      cancelled = true;
    };
  }, [user, retryKey]);

  const updateRemoteFields = useCallback((patch) => {
    if (!user || dataRef.current === null || !patch || Object.keys(patch).length === 0) return Promise.resolve();

    const currentData = dataRef.current || {};
    const changedPatch = Object.fromEntries(
      Object.entries(patch).filter(([key, value]) => !sameStoredValue(currentData[key], value)),
    );
    if (Object.keys(changedPatch).length === 0) return Promise.resolve();

    const nextData = { ...currentData, ...changedPatch };
    // Optimistic state means rapid duplicate browser events collapse locally before
    // the queued API call is sent, rather than consuming a database write each time.
    dataRef.current = nextData;
    setData(nextData);

    const queuedWrite = writeQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const saved = await requestUserData(user, 'PUT', nextData);
        const savedData = saved?.data && typeof saved.data === 'object' ? saved.data : nextData;
        dataRef.current = savedData;
        setData(savedData);
        setSyncError(null);
        return savedData;
      })
      .catch((error) => {
        console.warn('Could not save synced study data:', error);
        setSyncError('Study data is not syncing. Your changes remain on this device.');
        return undefined;
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
      {syncError && <div role="alert" style={{ padding: '10px 16px', background: '#fff3cd', color: '#382600' }}>
        {syncError} <button type="button" onClick={() => setRetryKey((key) => key + 1)}>Retry</button>
      </div>}
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => useContext(SyncContext);
