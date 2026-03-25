import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3000;

  // Socket.io connection
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join", (userId) => {
      socket.join(userId);
      console.log("User joined room:", userId);
    });

    socket.on("booking:request", (data) => {
      console.log("Booking request received:", data);
      io.to(data.hostUid).emit("notification", {
        type: "booking_request",
        message: "New booking request!",
        data
      });
    });

    socket.on("booking:update", (data) => {
      console.log("Booking update received:", data);
      io.to(data.guestUid).emit("notification", {
        type: "booking_update",
        message: `Booking ${data.status}!`,
        data
      });
    });

    socket.on("booking:confirmed", (data) => {
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
