import { encoreRequest } from './encore-client';

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
