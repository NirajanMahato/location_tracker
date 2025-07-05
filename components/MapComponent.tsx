"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

interface MapComponentProps {
  socket: Socket | null;
  onStatusChange: (status: {
    message: string;
    type: "success" | "error" | "info";
  }) => void;
}

interface LocationData {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

// Leaflet types
interface LeafletMap {
  setView: (coords: [number, number], zoom: number) => LeafletMap;
  addLayer: (layer: LeafletLayer) => LeafletMap;
  removeLayer: (layer: LeafletLayer) => LeafletMap;
  setBearing: (bearing: number) => void;
}

interface LeafletMarker {
  setLatLng: (coords: [number, number]) => LeafletMarker;
  addTo: (map: LeafletMap) => LeafletMarker;
  accuracyCircle?: LeafletCircle;
}

interface LeafletCircle {
  addTo: (map: LeafletMap) => LeafletCircle;
}

interface LeafletLayer {
  addTo: (map: LeafletMap) => LeafletLayer;
}

interface LeafletDivIcon {
  className: string;
  html: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
}

interface LeafletStatic {
  map: (element: HTMLElement) => LeafletMap;
  marker: (
    coords: [number, number],
    options?: { icon?: LeafletDivIcon }
  ) => LeafletMarker;
  divIcon: (options: LeafletDivIcon) => LeafletDivIcon;
  circle: (
    coords: [number, number],
    options: {
      radius: number;
      color: string;
      fillColor: string;
      fillOpacity: number;
      weight: number;
    }
  ) => LeafletCircle;
  tileLayer: (url: string, options: { attribution: string }) => LeafletLayer;
}

declare global {
  interface Window {
    L: LeafletStatic;
  }
}

export default function MapComponent({
  socket,
  onStatusChange,
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<{ [key: string]: LeafletMarker }>({});
  const userMarkerRef = useRef<LeafletMarker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const geolocationOptions = {
    enableHighAccuracy:
      process.env.NEXT_PUBLIC_GEOLOCATION_HIGH_ACCURACY === "true",
    maximumAge: parseInt(
      process.env.NEXT_PUBLIC_GEOLOCATION_MAX_AGE || "10000"
    ),
    timeout: parseInt(process.env.NEXT_PUBLIC_GEOLOCATION_TIMEOUT || "15000"),
  };

  const updateStatus = useCallback(
    (message: string, type: "success" | "error" | "info") => {
      onStatusChange({ message, type });
    },
    [onStatusChange]
  );

  const handleLocationSuccess = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;

      if (!mapInstanceRef.current || !isMapReady) {
        console.log("Map not ready yet, skipping location update");
        return;
      }

      if (!userMarkerRef.current) {
        userMarkerRef.current = window.L.marker([latitude, longitude], {
          icon: window.L.divIcon({
            className: "user-marker",
            html: '<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
        }).addTo(mapInstanceRef.current);

        mapInstanceRef.current.setView([latitude, longitude], 16);
      } else {
        userMarkerRef.current.setLatLng([latitude, longitude]);
      }

      if (userMarkerRef.current.accuracyCircle) {
        mapInstanceRef.current.removeLayer(
          userMarkerRef.current.accuracyCircle
        );
      }

      if (mapInstanceRef.current && accuracy) {
        userMarkerRef.current.accuracyCircle = window.L.circle(
          [latitude, longitude],
          {
            radius: accuracy,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.1,
            weight: 1,
          }
        ).addTo(mapInstanceRef.current);
      }

      if (socket) {
        socket.emit("send-location", {
          latitude,
          longitude,
          accuracy,
          timestamp: Date.now(),
        });
      }

      updateStatus("Location tracking active", "success");
    },
    [isMapReady, socket, updateStatus]
  );

  const handleLocationError = useCallback(
    (error: GeolocationPositionError) => {
      console.error("Geolocation error:", error);
      let errorMessage = "Location access denied";

      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage =
            "Location permission denied. Please enable location access.";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = "Location information unavailable.";
          break;
        case error.TIMEOUT:
          errorMessage = "Location request timed out.";
          break;
        default:
          errorMessage = "An unknown error occurred.";
      }

      updateStatus(errorMessage, "error");
    },
    [updateStatus]
  );

  const refreshLocation = useCallback(() => {
    if (navigator.geolocation && isMapReady) {
      updateStatus("Refreshing location...", "info");
      navigator.geolocation.getCurrentPosition(
        handleLocationSuccess,
        handleLocationError,
        geolocationOptions
      );
    } else {
      updateStatus("Map not ready yet", "error");
    }
  }, [
    isMapReady,
    updateStatus,
    handleLocationSuccess,
    handleLocationError,
    geolocationOptions,
  ]);

  const resetMapRotation = useCallback(() => {
    if (mapInstanceRef.current && isMapReady) {
      mapInstanceRef.current.setBearing(0);
      updateStatus("Map rotated to north", "info");
    }
  }, [isMapReady, updateStatus]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !mapRef.current || mapInstanceRef.current) return;

    const initMap = () => {
      // Check if Leaflet is already loaded
      if (window.L) {
        initializeMapInstance();
        return;
      }

      // Load Leaflet CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
      document.head.appendChild(link);

      // Load Leaflet JS
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = () => {
        if (!mapRef.current) {
          console.error("Map container not found");
          return;
        }
        initializeMapInstance();
      };
      document.head.appendChild(script);
    };

    const initializeMapInstance = () => {
      if (!mapRef.current) {
        console.error("Map container not found");
        return;
      }

      const mapTileUrl =
        process.env.NEXT_PUBLIC_MAP_TILE_URL ||
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      const mapAttribution =
        process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
        "© OpenStreetMap contributors";

      try {
        mapInstanceRef.current = window.L.map(mapRef.current).setView(
          [20, 0],
          2
        );

        window.L.tileLayer(mapTileUrl, {
          attribution: mapAttribution,
        }).addTo(mapInstanceRef.current);

        setIsMapReady(true);
        updateStatus("Map loaded successfully", "success");
      } catch (error) {
        console.error("Error initializing map:", error);
        updateStatus("Failed to load map", "error");
      }
    };

    const timer = setTimeout(initMap, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
      setIsMapReady(false);
    };
  }, [isClient, updateStatus]);

  useEffect(() => {
    if (!isMapReady) return;

    if (navigator.geolocation) {
      updateStatus("Requesting location access...", "info");

      watchIdRef.current = navigator.geolocation.watchPosition(
        handleLocationSuccess,
        handleLocationError,
        geolocationOptions
      );
    } else {
      updateStatus("Geolocation is not supported by this browser.", "error");
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [
    isMapReady,
    handleLocationSuccess,
    handleLocationError,
    geolocationOptions,
    updateStatus,
  ]);

  useEffect(() => {
    if (!socket || !mapInstanceRef.current || !isMapReady) return;

    const handleReceiveLocation = (data: LocationData) => {
      const { id, latitude, longitude, accuracy, timestamp } = data;

      if (id === socket.id) return;

      const dataExpiry = parseInt(
        process.env.NEXT_PUBLIC_LOCATION_DATA_EXPIRY || "30000"
      );
      if (Date.now() - timestamp > dataExpiry) return;

      if (markersRef.current[id]) {
        markersRef.current[id].setLatLng([latitude, longitude]);
        if (markersRef.current[id].accuracyCircle) {
          mapInstanceRef.current?.removeLayer(
            markersRef.current[id].accuracyCircle!
          );
        }
      } else {
        markersRef.current[id] = window.L.marker([latitude, longitude], {
          icon: window.L.divIcon({
            className: "other-user-marker",
            html: '<div style="background-color: #dc2626; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.3);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        }).addTo(mapInstanceRef.current!);
      }

      if (accuracy && mapInstanceRef.current) {
        markersRef.current[id].accuracyCircle = window.L.circle(
          [latitude, longitude],
          {
            radius: accuracy,
            color: "#dc2626",
            fillColor: "#dc2626",
            fillOpacity: 0.1,
            weight: 1,
          }
        ).addTo(mapInstanceRef.current);
      }
    };

    const handleUserDisconnected = (id: string) => {
      if (markersRef.current[id] && mapInstanceRef.current) {
        if (markersRef.current[id].accuracyCircle) {
          mapInstanceRef.current.removeLayer(
            markersRef.current[id].accuracyCircle!
          );
        }
        mapInstanceRef.current.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    };

    socket.on("receive-location", handleReceiveLocation);
    socket.on("user-disconnected", handleUserDisconnected);

    return () => {
      socket.off("receive-location", handleReceiveLocation);
      socket.off("user-disconnected", handleUserDisconnected);
    };
  }, [socket, isMapReady]);

  useEffect(() => {
    (window as Window & { refreshLocation?: () => void }).refreshLocation =
      refreshLocation;
    (window as Window & { resetMapRotation?: () => void }).resetMapRotation =
      resetMapRotation;

    return () => {
      delete (window as Window & { refreshLocation?: () => void })
        .refreshLocation;
      delete (window as Window & { resetMapRotation?: () => void })
        .resetMapRotation;
    };
  }, [refreshLocation, resetMapRotation]);

  if (!isClient) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-600">Loading map...</div>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="w-full h-full"
      style={{ minHeight: "400px" }}
    />
  );
}
