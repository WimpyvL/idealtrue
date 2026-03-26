import { SQLDatabase } from "encore.dev/storage/sqldb";

export const identityDB = new SQLDatabase("identity-db", {
  migrations: "./migrations",
});
