import { Bucket } from "encore.dev/storage/objects";

export const listingMediaBucket = new Bucket("listing-media-public", {
  public: true,
});
