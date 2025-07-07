"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [locationPermission, setLocationPermission] =
    useState<PermissionState | null>(null);

  const geolocationOptions = useMemo(
    () => ({
      enableHighAccuracy: true, // Force high accuracy for better iOS support
      maximumAge: parseInt(
        process.env.NEXT_PUBLIC_GEOLOCATION_MAX_AGE || "10000"
      ),
      timeout: parseInt(process.env.NEXT_PUBLIC_GEOLOCATION_TIMEOUT || "15000"),
    }),
    []
  );

  const updateStatus = useCallback(
    (message: string, type: "success" | "error" | "info") => {
      onStatusChange({ message, type });
    },
    [onStatusChange]
  );

  const checkLocationPermission = useCallback(async () => {
    if (!navigator.permissions) {
      // Fallback for browsers that don't support permissions API
      return "granted";
    }

    try {
      const permission = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });
      setLocationPermission(permission.state);
      return permission.state;
    } catch (error) {
      console.warn(
        "Permissions API not supported, falling back to direct geolocation request"
      );
      return "prompt";
    }
  }, []);

  const requestLocationPermission = useCallback(() => {
    updateStatus("Requesting location permission...", "info");

    // For iOS Safari, we need to trigger a user gesture
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateStatus("Location permission granted", "success");
          setLocationPermission("granted");
          handleLocationSuccess(position);
        },
        (error) => {
          handleLocationError(error);
          setLocationPermission("denied");
        },
        geolocationOptions
      );
    } else {
      updateStatus("Geolocation is not supported by this browser.", "error");
    }
  }, [updateStatus, geolocationOptions]);

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
            "Location permission denied. Please enable location access in your browser settings.";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage =
            "Location information unavailable. Please check your GPS settings.";
          break;
        case error.TIMEOUT:
          errorMessage = "Location request timed out. Please try again.";
          break;
        default:
          errorMessage = "An unknown error occurred while getting location.";
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

    // Check location permission first
    checkLocationPermission().then((permission) => {
      if (permission === "granted") {
        // Start watching location
        if (navigator.geolocation) {
          updateStatus("Starting location tracking...", "info");
          watchIdRef.current = navigator.geolocation.watchPosition(
            handleLocationSuccess,
            handleLocationError,
            geolocationOptions
          );
        }
      } else if (permission === "prompt") {
        updateStatus("Click 'Allow Location' to start tracking", "info");
      } else {
        updateStatus(
          "Location permission denied. Please enable location access.",
          "error"
        );
      }
    });

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [
    isMapReady,
    checkLocationPermission,
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
    <div className="w-full h-full relative">
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ minHeight: "400px" }}
      />

      {/* Location Permission Button for iOS */}
      {isMapReady && locationPermission !== "granted" && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm mx-4 text-center">
            <h3 className="text-lg font-semibold mb-2">
              Location Access Required
            </h3>
            <p className="text-gray-600 mb-4">
              This app needs location access to show your position on the map
              and share it with other users.
            </p>
            <button
              onClick={requestLocationPermission}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Allow Location Access
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
