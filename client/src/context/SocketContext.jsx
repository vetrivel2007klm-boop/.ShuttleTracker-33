import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api from '../services/api';

const SocketContext = createContext();

const getSocketServerUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  const isLocal =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal && window.location.port === '5173') {
    return 'http://localhost:5000';
  }
  if (window.location.port === '5173') {
    return `http://${window.location.hostname}:5000`;
  }
  return window.location.origin;
};

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [liveLocations, setLiveLocations] = useState({});
  const [realtimeNotifications, setRealtimeNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestAlert, setLatestAlert] = useState(null);
  const [simulationActive, setSimulationActive] = useState(false);
  const relayedEmailIdsRef = useRef(new Set());

  const dispatchSingleClientRelay = (relayPayload) => {
    if (
      !relayPayload ||
      !relayPayload.to ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      return;
    }
    const relayKey =
      relayPayload.relayId || `${relayPayload.to}::${relayPayload.subject || ''}`;
    if (relayedEmailIdsRef.current.has(relayKey)) {
      return;
    }
    try {
      const storageKey = `shuttle_relayed_${relayKey}`;
      if (window.localStorage.getItem(storageKey)) {
        relayedEmailIdsRef.current.add(relayKey);
        return;
      }
      window.localStorage.setItem(storageKey, String(Date.now()));
    } catch (_) {}
    relayedEmailIdsRef.current.add(relayKey);
    fetch('http://localhost:5000/api/auth/relay-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(relayPayload)
    }).catch(() => {});
  };

  // Load initial notifications from backend when authenticated
  useEffect(() => {
    if (!token || !user) return;
    const loadInitialNotifications = async () => {
      try {
        const res = await api.get('/notifications');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setRealtimeNotifications(res.data.data);
          setUnreadCount(res.data.data.length);
        }
      } catch (_) {}
    };
    loadInitialNotifications();
  }, [token, user?.id, user?.role]);

  useEffect(() => {
    const serverUrl = getSocketServerUrl();
    const socketInstance = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    socketInstance.on('connect', () => {
      console.log('⚡ Socket connected to ShuttleTrack gateway:', serverUrl);
      setIsConnected(true);

      if (user?.role === 'admin') {
        socketInstance.emit('join:admin');
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('⚡ Socket disconnected');
      setIsConnected(false);
    });

    // Handle real-time shuttle location updates
    socketInstance.on('shuttle:location_updated', (update) => {
      setLiveLocations((prev) => ({
        ...prev,
        [update.shuttleId]: {
          ...prev[update.shuttleId],
          ...update
        }
      }));
    });

    socketInstance.on('shuttle:quick_ping', (update) => {
      setLiveLocations((prev) => ({
        ...prev,
        [update.shuttleId]: {
          ...prev[update.shuttleId],
          ...update
        }
      }));
    });

    // Handle real-time push notification
    socketInstance.on('notification:new', (notif) => {
      if (!notif) return;
      setRealtimeNotifications((prev) => {
        const isDuplicate = prev.some(
          (n) => n.id && notif.id && Number(n.id) === Number(notif.id)
        );
        if (isDuplicate) return prev;
        setUnreadCount((c) => c + 1);
        setLatestAlert({ ...notif, _receivedAt: Date.now() });
        return [notif, ...prev];
      });
    });

    // Sync liveLocations when shuttle status changes or trip starts/ends
    socketInstance.on('shuttle:updated', (shuttle) => {
      if (shuttle && shuttle.id && shuttle.status === 'idle') {
        setLiveLocations((prev) => {
          if (!prev[shuttle.id]) return prev;
          return {
            ...prev,
            [shuttle.id]: {
              ...prev[shuttle.id],
              status: 'idle',
              speed: 0
            }
          };
        });
      }
    });

    socketInstance.on('trip:status_change', ({ type, shuttleId }) => {
      if (type === 'started' && shuttleId) {
        setRealtimeNotifications((prev) =>
          prev.map((n) =>
            Number(n.shuttle_id) === Number(shuttleId) ? { ...n, _archivedTrip: true } : n
          )
        );
      } else if (type === 'ended' && shuttleId) {
        setSimulationActive(false);
        setLiveLocations((prev) => {
          if (!prev[shuttleId]) return prev;
          return {
            ...prev,
            [shuttleId]: {
              ...prev[shuttleId],
              status: 'idle',
              speed: 0
            }
          };
        });
      }
    });

    socketInstance.on('simulation:state', ({ running }) => {
      setSimulationActive(running);
    });

    socketInstance.on('email:relay', (relayPayload) => {
      dispatchSingleClientRelay(relayPayload);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user?.role, token]);

  const relayCloudEmail = (relayPayload) => {
    dispatchSingleClientRelay(relayPayload);
  };

  const clearShuttleLiveLocation = (shuttleId) => {
    if (!shuttleId) return;
    setLiveLocations((prev) => {
      if (!prev[shuttleId]) return prev;
      return {
        ...prev,
        [shuttleId]: {
          ...prev[shuttleId],
          status: 'idle',
          speed: 0
        }
      };
    });
  };

  const joinShuttle = (shuttleId) => {
    if (socket && isConnected) {
      socket.emit('join:shuttle', shuttleId);
    }
  };

  const leaveShuttle = (shuttleId) => {
    if (socket && isConnected) {
      socket.emit('leave:shuttle', shuttleId);
    }
  };

  const sendDriverLocation = (locationData) => {
    if (socket && isConnected) {
      socket.emit('driver:location_update', locationData);
    }
  };

  const startSimulation = (shuttleId) => {
    if (socket && isConnected) {
      socket.emit('driver:start_simulation', { shuttleId });
      setSimulationActive(false);
    }
  };

  const stopSimulation = (shuttleId) => {
    if (socket && isConnected) {
      socket.emit('driver:stop_simulation', { shuttleId });
      setSimulationActive(false);
    }
  };

  const clearUnread = () => {
    setUnreadCount(0);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        liveLocations,
        realtimeNotifications,
        unreadCount,
        latestAlert,
        simulationActive,
        joinShuttle,
        leaveShuttle,
        sendDriverLocation,
        startSimulation,
        stopSimulation,
        clearUnread,
        relayCloudEmail,
        clearShuttleLiveLocation
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
