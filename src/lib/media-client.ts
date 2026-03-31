import { encoreRequest } from './encore-client';

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
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, 1800 / image.naturalWidth, 1800 / image.naturalHeight);
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
      if (candidate.size <= 1.6 * 1024 * 1024) {
        return candidate;
      }
    }

    if (!bestBlob || bestBlob.size > 1.6 * 1024 * 1024) {
      throw new Error('Image is too large. Please use a smaller or less detailed photo.');
    }

    return bestBlob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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

export async function uploadListingImage(params: { listingId?: string; file: File }) {
  const compressed = await compressImage(params.file);
  const safeFilename = params.file.name.replace(/\.[^.]+$/, '') || 'listing-photo';
  const response = await encoreRequest<{ objectKey: string; publicUrl: string }>(
    '/host/listings/media/images',
    {
      method: 'POST',
      body: JSON.stringify({
        listingId: params.listingId,
        filename: `${safeFilename}.jpg`,
        contentType: 'image/jpeg',
        dataBase64: await blobToBase64(compressed),
      }),
    },
    { auth: true },
  );

  return response.publicUrl;
}

export async function uploadListingMedia(params: { listingId?: string; file: File }) {
  const signed = await encoreRequest<{ objectKey: string; uploadUrl: string; publicUrl: string }>(
    '/host/listings/media/upload-url',
    {
      method: 'POST',
      body: JSON.stringify({
        listingId: params.listingId,
        filename: params.file.name,
        contentType: params.file.type || 'application/octet-stream',
      }),
    },
    { auth: true },
  );

  await uploadToSignedUrl(signed.uploadUrl, params.file);
  return signed.publicUrl;
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
