import { SQLDatabase } from "encore.dev/storage/sqldb";

export const referralsDB = new SQLDatabase("referrals-db", {
  migrations: "./migrations",
});
