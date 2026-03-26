import { Bucket } from "encore.dev/storage/objects";

export const kycDocumentsBucket = new Bucket("kyc-documents-private");
export const moderationEvidenceBucket = new Bucket("moderation-evidence-private");
