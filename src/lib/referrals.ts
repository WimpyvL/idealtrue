import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  increment,
  query,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { OperationType } from '../types';
import { handleFirestoreError } from './firestore';

export type ReferralType = 'signup' | 'booking';

export async function processReferralReward(
  referrerUid: string, 
  referredUid: string, 
  type: ReferralType, 
  amount: number = 50
) {
  try {
    // 1. Get referrer profile
    const referrerRef = doc(db, 'users', referrerUid);
    const referrerSnap = await getDoc(referrerRef);
    
    if (!referrerSnap.exists()) {
      console.warn('Referrer profile not found:', referrerUid);
      return;
    }

    const referrerData = referrerSnap.data();
    const currentReferralCount = (referrerData.referralCount || 0) + 1;

    // 2. Determine new tier
    let newTier = 'bronze';
    if (currentReferralCount >= 16) {
      newTier = 'gold';
    } else if (currentReferralCount >= 6) {
      newTier = 'silver';
    }

    // 3. Update referrer profile
    await updateDoc(referrerRef, {
      balance: increment(amount),
      referralCount: increment(1),
      tier: newTier
    });

    // 4. Create referral record
    await addDoc(collection(db, 'referrals'), {
      referrerUid,
      referredUid,
      amount,
      type,
      createdAt: new Date().toISOString()
    });

    console.log(`Successfully processed ${type} referral reward for ${referrerUid}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'referrals');
  }
}

export async function getReferrerByCode(referralCode: string): Promise<string | null> {
  try {
    const q = query(collection(db, 'users'), where('referralCode', '==', referralCode), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].id;
  } catch (error) {
    console.error('Error finding referrer:', error);
    return null;
  }
}
