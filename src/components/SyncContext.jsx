import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const SyncContext = createContext();

export function SyncProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!user) {
      setData(null);
      return;
    }
    
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setData(docSnap.data());
      } else {
        // Initialize if doesn't exist
        setDoc(userRef, { bookmarks: [], assessments: [], appearance: {}, selectedSubject: null, selectedLevel: 12, updatedAt: new Date() });
      }
    });

    return unsubscribe;
  }, [user]);

  const updateRemote = async (key, value) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { [key]: value, updatedAt: new Date() }, { merge: true });
  };

  return (
    <SyncContext.Provider value={{ data, updateRemote }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => useContext(SyncContext);
