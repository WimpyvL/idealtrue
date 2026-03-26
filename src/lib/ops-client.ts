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

async function uploadSigned(uploadUrl: string, blob: Blob, contentType: string) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}

export async function uploadKycAsset(file: File) {
  const signed = await encoreRequest<{ objectKey: string; uploadUrl: string }>(
    '/ops/kyc/upload-url',
    {
      method: 'POST',
      body: JSON.stringify({ filename: file.name }),
    },
    { auth: true },
  );
  await uploadSigned(signed.uploadUrl, file, file.type || 'application/octet-stream');
  return signed.objectKey;
}

export async function uploadKycDataUrl(filename: string, dataUrl: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const signed = await encoreRequest<{ objectKey: string; uploadUrl: string }>(
    '/ops/kyc/upload-url',
    {
      method: 'POST',
      body: JSON.stringify({ filename }),
    },
    { auth: true },
  );
  await uploadSigned(signed.uploadUrl, blob, blob.type || 'image/jpeg');
  return signed.objectKey;
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
