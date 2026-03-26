import { SQLDatabase } from "encore.dev/storage/sqldb";

export const bookingDB = new SQLDatabase("booking-db", {
  migrations: "./migrations",
});
