import { encoreRequest } from './encore-client';

export interface KycSubmission {
  id: string;
  userId: string;
  idType: 'id_card' | 'passport' | 'drivers_license';
  idNumber: string;
  idImageKey: string;
  selfieImageKey: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewerId?: string | null;
}

export interface KycSubmissionAssets {
  idImageUrl: string;
  selfieImageUrl: string;
}

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function uploadKycAsset(file: File) {
  const dataBase64 = await blobToBase64(file);
  const uploaded = await encoreRequest<{ objectKey: string }>(
    '/ops/kyc/upload',
    {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'image/jpeg',
        dataBase64,
      }),
    },
    { auth: true },
  );
  return uploaded.objectKey;
}

export async function uploadKycDataUrl(filename: string, dataUrl: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const dataBase64 = await blobToBase64(blob);
  const uploaded = await encoreRequest<{ objectKey: string }>(
    '/ops/kyc/upload',
    {
      method: 'POST',
      body: JSON.stringify({
        filename,
        contentType: blob.type || 'image/jpeg',
        dataBase64,
      }),
    },
    { auth: true },
  );
  return uploaded.objectKey;
}

export async function submitKyc(params: {
  idType: 'id_card' | 'passport' | 'drivers_license';
  idNumber: string;
  idImageKey: string;
  selfieImageKey: string;
}) {
  const response = await encoreRequest<{ submission: KycSubmission }>(
    '/ops/kyc/submissions',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return response.submission;
}

export async function getMyKycSubmission() {
  const response = await encoreRequest<{ submission: KycSubmission | null }>(
    '/ops/kyc/submissions/me',
    {},
    { auth: true },
  );
  return response.submission;
}

export async function listKycSubmissions() {
  const response = await encoreRequest<{ submissions: KycSubmission[] }>(
    '/ops/kyc/submissions',
    {},
    { auth: true },
  );
  return response.submissions;
}

export async function reviewKycSubmission(params: {
  userId: string;
  status: 'verified' | 'rejected';
  rejectionReason?: string | null;
}) {
  const response = await encoreRequest<{ submission: KycSubmission }>(
    '/ops/kyc/submissions/review',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    { auth: true },
  );
  return response.submission;
}

export async function getKycSubmissionAssets(userId: string) {
  const response = await encoreRequest<{ assets: KycSubmissionAssets }>(
    `/ops/kyc/submissions/${encodeURIComponent(userId)}/assets`,
    {},
    { auth: true },
  );
  return response.assets;
}
