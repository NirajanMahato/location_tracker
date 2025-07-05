import { Server as NetServer } from "http";
import { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO } from "socket.io";

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ServerWithIO extends NetServer {
  io?: ServerIO;
}

const SocketHandler = (req: NextApiRequest, res: NextApiResponse) => {
  if (!res.socket) {
    res.status(500).json({ error: "Socket not available" });
    return;
  }

  // Type assertion to access the server
  const server = (res.socket as unknown as { server: ServerWithIO }).server;

  if (server.io) {
    console.log("Socket is already running");
    res.end();
    return;
  }

  console.log("Setting up socket");

  // Create Socket.IO server with proper configuration
  const io = new ServerIO(server as ServerWithIO, {
    path: "/api/socket",
    addTrailingSlash: false,
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? ([
              process.env.NEXT_PUBLIC_SITE_URL,
              process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : null,
              process.env.DOMAIN_URL,
            ].filter(Boolean) as string[])
          : [
              "http://localhost:3000",
              "http://localhost:3001",
              "http://127.0.0.1:3000",
            ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
    allowEIO3: true,
  });

  server.io = io;

  const connectedUsers = new Map();

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    connectedUsers.set(socket.id, { connectedAt: new Date() });

    // Send initial connection confirmation
    socket.emit("connected", { id: socket.id, message: "Connected to server" });

    socket.on("send-location", (data) => {
      try {
        const { latitude, longitude, accuracy, timestamp } = data;

        if (
          typeof latitude === "number" &&
          typeof longitude === "number" &&
          latitude >= -90 &&
          latitude <= 90 &&
          longitude >= -180 &&
          longitude <= 180
        ) {
          connectedUsers.set(socket.id, {
            ...connectedUsers.get(socket.id),
            latitude,
            longitude,
            accuracy,
            lastUpdate: new Date(),
            timestamp,
          });

          socket.broadcast.emit("receive-location", {
            id: socket.id,
            latitude,
            longitude,
            accuracy,
            timestamp,
          });

          console.log(
            `Location update from ${socket.id}: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`
          );
        } else {
          console.warn(`Invalid location data from ${socket.id}:`, data);
          socket.emit("error", { message: "Invalid location data" });
        }
      } catch (error) {
        console.error(
          `Error processing location data from ${socket.id}:`,
          error
        );
        socket.emit("error", { message: "Error processing location data" });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
      connectedUsers.delete(socket.id);
      io.emit("user-disconnected", socket.id);
    });

    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // Handle server errors
  io.engine.on("connection_error", (err) => {
    console.error("Socket.IO connection error:", err);
  });

  res.end();
};

export default SocketHandler;
