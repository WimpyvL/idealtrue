import { db } from '@/firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, query, where, Timestamp } from 'firebase/firestore';
import { handleFirestoreError } from './firestore';
import { OperationType } from '@/types';

export const getClient = {
  hospitality: {
    async getListing(id: string) {
      const path = `listings/${id}`;
      try {
        const docRef = doc(db, 'listings', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return { listing: { id: docSnap.id, ...docSnap.data() } };
        }
        return { listing: null };
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
        return { listing: null };
      }
    },
    async saveListing(data: any) {
      const { id, ...payload } = data;
      const listingData = {
        ...payload,
        updatedAt: new Date().toISOString()
      };

      try {
        if (id) {
          const docRef = doc(db, 'listings', id);
          await updateDoc(docRef, listingData);
          return { id };
        } else {
          const docRef = await addDoc(collection(db, 'listings'), {
            ...listingData,
            status: 'pending',
            createdAt: new Date().toISOString()
          });
          return { id: docRef.id };
        }
      } catch (error) {
        handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, 'listings');
        throw error;
      }
    }
  }
};
