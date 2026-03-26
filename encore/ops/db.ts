import { SQLDatabase } from "encore.dev/storage/sqldb";

export const opsDB = new SQLDatabase("ops-db", {
  migrations: "./migrations",
});
