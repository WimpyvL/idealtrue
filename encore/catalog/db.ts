import { SQLDatabase } from "encore.dev/storage/sqldb";

export const catalogDB = new SQLDatabase("catalog-db", {
  migrations: "./migrations",
});
