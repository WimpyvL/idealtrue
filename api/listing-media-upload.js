export const config = {
  api: {
    bodyParser: false,
  },
};

const DEFAULT_ENCORE_API_URL = "https://staging-ideal-stay-online-gh5i.encr.app";

function getEncoreApiUrl() {
  return (process.env.ENCORE_API_URL || process.env.VITE_ENCORE_API_URL || DEFAULT_ENCORE_API_URL).replace(/\/+$/, "");
}

function normalizeListingId(listingId) {
  if (!listingId) {
    return "";
  }

  const normalized = String(listingId).trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return "";
  }

  return normalized;
}

async function readBuffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Missing authorization header." });
    return;
  }

  const requestUrl = new URL(req.url, "http://vercel.local");
  const listingId = normalizeListingId(requestUrl.searchParams.get("listingId"));
  const filename = requestUrl.searchParams.get("filename") || "listing-video";
  const contentType = requestUrl.searchParams.get("contentType") || req.headers["content-type"] || "application/octet-stream";

  try {
    const signedResponse = await fetch(`${getEncoreApiUrl()}/host/listings/media/upload-url`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        listingId,
        filename,
        contentType,
      }),
    });

    if (!signedResponse.ok) {
      const body = await signedResponse.text();
      res.status(signedResponse.status).send(body || "Could not request an upload URL.");
      return;
    }

    const signed = await signedResponse.json();
    const payload = await readBuffer(req);

    const uploadResponse = await fetch(signed.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: payload,
    });

    if (!uploadResponse.ok) {
      const body = await uploadResponse.text();
      res.status(uploadResponse.status).send(body || "Could not upload video.");
      return;
    }

    res.status(200).json({
      objectKey: signed.objectKey,
      publicUrl: signed.publicUrl,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Video upload failed.",
    });
  }
}
