import { encoreFetch, encoreRequest } from './encore-client';

export interface SerializedImageAsset {
  filename: string;
  contentType: 'image/jpeg';
  dataBase64: string;
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

async function compressImage(file: File) {
  return compressImageFile(file, {
    maxDimension: 1800,
    maxBytes: Math.round(1.6 * 1024 * 1024),
  });
}

async function compressImageFile(
  file: File,
  {
    maxDimension,
    maxBytes,
  }: {
    maxDimension: number;
    maxBytes: number;
  },
) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, maxDimension / image.naturalWidth, maxDimension / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not prepare the image for upload.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    let bestBlob: Blob | null = null;
    for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) {
      const candidate = await canvasToBlob(canvas, quality);
      bestBlob = candidate;
      if (candidate.size <= maxBytes) {
        return candidate;
      }
    }

    if (!bestBlob || bestBlob.size > maxBytes) {
      throw new Error('Image is too large. Please use a smaller or less detailed photo.');
    }

    return bestBlob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function serializeImageFile(
  file: File,
  {
    maxDimension = 1600,
    maxBytes = 450 * 1024,
    fallbackName = 'image-upload',
  }: {
    maxDimension?: number;
    maxBytes?: number;
    fallbackName?: string;
  } = {},
): Promise<SerializedImageAsset> {
  const compressed = await compressImageFile(file, { maxDimension, maxBytes });
  const safeFilename = file.name.replace(/\.[^.]+$/, '') || fallbackName;
  return {
    filename: `${safeFilename}.jpg`,
    contentType: 'image/jpeg',
    dataBase64: await blobToBase64(compressed),
  };
}

async function uploadToSignedUrl(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}

function useSameOriginUploadProxy() {
  if (typeof window === 'undefined') {
    return false;
  }

  const { hostname } = window.location;
  return hostname !== 'localhost' && hostname !== '127.0.0.1';
}

export async function uploadListingImage(params: { listingId?: string; file: File }) {
  const serialized = await serializeImageFile(params.file, {
    maxDimension: 1800,
    maxBytes: Math.round(1.6 * 1024 * 1024),
    fallbackName: 'listing-photo',
  });
  const response = await encoreRequest<{ objectKey: string; publicUrl: string }>(
    '/host/listings/media/images',
    {
      method: 'POST',
      body: JSON.stringify({
        listingId: params.listingId,
        filename: serialized.filename,
        contentType: serialized.contentType,
        dataBase64: serialized.dataBase64,
      }),
    },
    { auth: true },
  );

  return response.publicUrl;
}

export async function uploadListingMedia(params: { listingId?: string; file: File }) {
  if (useSameOriginUploadProxy()) {
    const query = new URLSearchParams({
      listingId: params.listingId ?? '',
      filename: params.file.name,
      contentType: params.file.type || 'application/octet-stream',
    });

    const response = await encoreFetch(`/api/listing-media-upload?${query.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': params.file.type || 'application/octet-stream',
        'X-Upload-Filename': params.file.name,
      },
      body: params.file,
    }, { auth: true });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `Video upload failed with status ${response.status}`);
    }

    const payload = await response.json() as { objectKey: string; publicUrl: string };
    return payload.publicUrl;
  }

  const query = new URLSearchParams({
    listingId: params.listingId ?? '',
    filename: params.file.name,
    contentType: params.file.type || 'application/octet-stream',
  });

  const response = await encoreFetch(`/host/listings/media/videos?${query.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': params.file.type || 'application/octet-stream',
      'X-Upload-Filename': params.file.name,
    },
    body: params.file,
  }, { auth: true });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Video upload failed with status ${response.status}`);
  }

  const payload = await response.json() as { objectKey: string; publicUrl: string };
  return payload.publicUrl;
}

export async function uploadChatAttachment(params: { bookingId: string; file: File }) {
  const signed = await encoreRequest<{ objectKey: string; uploadUrl: string }>(
    '/messages/attachments/upload-url',
    {
      method: 'POST',
      body: JSON.stringify({
        bookingId: params.bookingId,
        filename: params.file.name,
      }),
    },
    { auth: true },
  );

  await uploadToSignedUrl(signed.uploadUrl, params.file);
  return signed.objectKey;
}
