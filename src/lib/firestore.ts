import { OperationType, FirestoreErrorInfo } from '@/types';
import { hasEncoreSessionToken } from './encore-client';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      providerInfo: hasEncoreSessionToken()
        ? [{
            providerId: 'encore-session',
            displayName: 'Encore session',
            email: null,
            photoUrl: null,
          }]
        : [],
    },
    operationType,
    path
  };
  console.error('Platform request error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
