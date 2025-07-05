"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const MapComponent = dynamic(() => import("../components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-gray-600">Loading map...</div>
    </div>
  ),
});

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";

    console.log("Connecting to socket server:", socketUrl);

    const newSocket = io(socketUrl, {
      path: "/api/socket",
      transports: ["polling", "websocket"],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      setStatus({ message: "Connected to server", type: "success" });
    });

    newSocket.on("connected", (data) => {
      console.log("Server confirmed connection:", data);
      setStatus({ message: "Server connection confirmed", type: "success" });
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setStatus({ message: `Disconnected: ${reason}`, type: "error" });
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setStatus({
        message: `Connection failed: ${error.message}`,
        type: "error",
      });
    });

    newSocket.on("error", (error) => {
      console.error("Socket error:", error);
      setStatus({
        message: `Socket error: ${error.message || "Unknown error"}`,
        type: "error",
      });
    });

    newSocket.on("reconnect", (attemptNumber) => {
      console.log("Socket reconnected after", attemptNumber, "attempts");
      setStatus({
        message: `Reconnected after ${attemptNumber} attempts`,
        type: "success",
      });
    });

    newSocket.on("reconnect_error", (error) => {
      console.error("Socket reconnection error:", error);
      setStatus({
        message: `Reconnection failed: ${error.message}`,
        type: "error",
      });
    });

    setSocket(newSocket);

    return () => {
      console.log("Cleaning up socket connection");
      newSocket.close();
    };
  }, [isClient]);

  const refreshLocation = () => {
    if (socket) {
      setStatus({ message: "Refreshing location...", type: "info" });
    }
  };

  const resetMapRotation = () => {
    setStatus({ message: "Map rotated to north", type: "info" });
  };

  // Don't render anything until we're on the client
  if (!isClient) {
    return (
      <main className="w-full h-full relative">
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <div className="text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full h-full relative">
      <MapComponent socket={socket} onStatusChange={setStatus} />

      <div
        className="map-control north-indicator top-5 right-5"
        onClick={resetMapRotation}
        style={{ zIndex: 9999 }}
      >
        <div className="control-icon">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2L12 22M12 2L6 8M12 2L18 8" />
          </svg>
        </div>
      </div>

      <div
        className="map-control refresh-button bottom-5 right-5"
        onClick={refreshLocation}
        style={{ zIndex: 9999 }}
      >
        <div className="control-icon">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
        </div>
      </div>

      <div className="legend" style={{ zIndex: 9999 }}>
        <div className="legend-item">
          <div className="legend-marker user"></div>
          <span>Your Location</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker other"></div>
          <span>Other Users</span>
        </div>
      </div>

      {status && (
        <div className={`status ${status.type}`} style={{ zIndex: 9999 }}>
          {status.message}
        </div>
      )}
    </main>
  );
}
