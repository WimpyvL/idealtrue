import { SQLDatabase } from "encore.dev/storage/sqldb";

export const messagingDB = new SQLDatabase("messaging-db", {
  migrations: "./migrations",
});
