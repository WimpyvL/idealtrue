import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

const ENCORE_API_URL =
  process.env.ENCORE_API_URL ||
  process.env.VITE_ENCORE_API_URL ||
  "http://127.0.0.1:4000";

function getAllowedOrigins() {
  const raw = process.env.SOCKET_IO_ORIGINS || process.env.CLIENT_ORIGIN || "http://localhost:3000";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function resolveSocketUserId(socket: any) {
  const authToken = typeof socket.handshake.auth?.token === "string"
    ? socket.handshake.auth.token
    : undefined;
  const headerToken = typeof socket.handshake.headers?.authorization === "string"
    ? socket.handshake.headers.authorization
    : undefined;
  const rawToken = authToken || headerToken;
  if (!rawToken) return null;

  const token = rawToken.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const response = await fetch(`${ENCORE_API_URL}/auth/session`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  const body = await response.json() as { user?: { id?: string } };
  return body.user?.id ?? null;
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const allowedOrigins = getAllowedOrigins();
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Socket origin is not allowed."));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  const PORT = 3000;

  io.use(async (socket, next) => {
    try {
      const userID = await resolveSocketUserId(socket);
      if (!userID) {
        next(new Error("Unauthenticated socket."));
        return;
      }
      socket.data.userID = userID;
      socket.join(userID);
      next();
    } catch (error) {
      next(new Error("Socket authentication failed."));
    }
  });

  // Socket.io connection
  io.on("connection", (socket) => {
    const userID = socket.data.userID as string;
    console.log("User connected:", socket.id, "user:", userID);

    socket.on("join", (userId) => {
      if (typeof userId === "string" && userId === userID) {
        socket.join(userID);
      }
    });

    socket.on("booking:request", (data) => {
      if (!data || data.guestUid !== userID || typeof data.hostUid !== "string") return;
      console.log("Booking request received:", data);
      io.to(data.hostUid).emit("notification", {
        type: "booking_request",
        message: "New booking request!",
        data
      });
    });

    socket.on("booking:update", (data) => {
      if (!data || data.hostUid !== userID || typeof data.guestUid !== "string") return;
      console.log("Booking update received:", data);
      io.to(data.guestUid).emit("notification", {
        type: "booking_update",
        message: `Booking ${data.status}!`,
        data
      });
    });

    socket.on("booking:confirmed", (data) => {
      if (!data || data.hostUid !== userID || typeof data.guestUid !== "string") return;
      console.log("Booking confirmed received:", data);
      io.to(data.guestUid).emit("booking:confirmed", data);
      // Also emit a generic notification for the UI to pick up if it doesn't listen for booking:confirmed
      io.to(data.guestUid).emit("notification", {
        type: "booking_confirmed",
        message: "Your booking has been confirmed!",
        data
      });
    });

    socket.on("chat:message", (data) => {
      if (!data || data.senderId !== userID || typeof data.receiverId !== "string") return;
      console.log("Chat message received:", data);
      io.to(data.receiverId).emit("notification", {
        type: "chat_message",
        message: `New message from ${data.senderName || 'someone'}`,
        data
      });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
