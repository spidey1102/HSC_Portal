import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const SyncContext = createContext();

function sameStoredValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function SyncProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const dataRef = useRef(null);

  useEffect(() => {
    dataRef.current = null;
    if (!user) {
      setData(null);
      return undefined;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const nextData = docSnap.data();
        dataRef.current = nextData;
        setData(nextData);
        return;
      }

      // Keep an optimistic local copy before creating the document. This prevents
      // duplicate initialisation writes if the listener reports a missing document
      // again before Firestore delivers the first snapshot.
      const initialData = {
        bookmarks: [],
        assessments: [],
        appearance: {},
        selectedSubject: null,
        selectedLevel: 12,
        mySubjects: [],
        viewedPapers: [],
        completedPapers: [],
        practiceReviews: [],
        mistakeLog: [],
      };
      dataRef.current = initialData;
      setData(initialData);
      setDoc(userRef, { ...initialData, updatedAt: new Date() }).catch((error) => {
        console.warn('Could not initialise synced study data:', error);
      });
    });

    return unsubscribe;
  }, [user]);

  const updateRemoteFields = useCallback(async (patch) => {
    if (!user || !patch || Object.keys(patch).length === 0) return;

    const currentData = dataRef.current || {};
    const changedPatch = Object.fromEntries(
      Object.entries(patch).filter(([key, value]) => !sameStoredValue(currentData[key], value)),
    );
    if (Object.keys(changedPatch).length === 0) return;

    // Update the mirror before awaiting Firestore so rapid duplicate browser
    // events collapse to one write rather than burning through daily quota.
    dataRef.current = { ...currentData, ...changedPatch };
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { ...changedPatch, updatedAt: new Date() }, { merge: true });
  }, [user]);

  const updateRemote = useCallback((key, value) => updateRemoteFields({ [key]: value }), [updateRemoteFields]);

  return (
    <SyncContext.Provider value={{ data, updateRemote, updateRemoteFields }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => useContext(SyncContext);
