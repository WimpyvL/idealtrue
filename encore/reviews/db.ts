import { SQLDatabase } from "encore.dev/storage/sqldb";

export const reviewsDB = new SQLDatabase("reviews-db", {
  migrations: "./migrations",
});
