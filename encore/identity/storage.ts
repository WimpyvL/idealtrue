import { Bucket } from "encore.dev/storage/objects";

export const profileMediaBucket = new Bucket("profile-media-public", {
  public: true,
});
