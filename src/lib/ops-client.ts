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

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not encode image.'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', quality);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image.'));
    image.src = src;
  });
}

async function compressKycBlob(
  blob: Blob,
  {
    maxWidth,
    maxHeight,
    maxBytes,
  }: {
    maxWidth: number;
    maxHeight: number;
    maxBytes: number;
  },
) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not prepare image canvas.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    let bestBlob: Blob | null = null;
    for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42]) {
      const candidate = await canvasToBlob(canvas, quality);
      bestBlob = candidate;
      if (candidate.size <= maxBytes) {
        return candidate;
      }
    }

    if (!bestBlob) {
      throw new Error('Could not compress image.');
    }

    if (bestBlob.size > maxBytes) {
      throw new Error('Image is too large. Please use a smaller or clearer photo.');
    }

    return bestBlob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function serializeKycBlob(
  blob: Blob,
  filename: string,
  limits: { maxWidth: number; maxHeight: number; maxBytes: number },
) {
  const compressed = await compressKycBlob(blob, limits);
  const safeFilename = filename.replace(/\.[^.]+$/, '') || 'kyc-upload';
  return {
    filename: `${safeFilename}.jpg`,
    contentType: 'image/jpeg',
    dataBase64: await blobToBase64(compressed),
  };
}

export async function serializeKycAsset(file: File) {
  return serializeKycBlob(file, file.name, {
    maxWidth: 1600,
    maxHeight: 1600,
    maxBytes: 320 * 1024,
  });
}

export async function serializeKycDataUrl(filename: string, dataUrl: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return serializeKycBlob(blob, filename, {
    maxWidth: 1200,
    maxHeight: 1200,
    maxBytes: 220 * 1024,
  });
}

export async function submitKyc(params: {
  idType: 'id_card' | 'passport' | 'drivers_license';
  idNumber: string;
  idImageKey?: string;
  selfieImageKey?: string;
  idImageFilename?: string;
  idImageContentType?: string;
  idImageDataBase64?: string;
  selfieImageFilename?: string;
  selfieImageContentType?: string;
  selfieImageDataBase64?: string;
}) {
  const response = await encoreRequest<{ submission: KycSubmission }>(
    '/ops/kyc/submissions',
    {
      method: 'POST',
      body: JSON.stringify({
        idImageKey: '',
        selfieImageKey: '',
        ...params,
      }),
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
