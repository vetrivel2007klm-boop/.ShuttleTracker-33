import React, { createContext, useContext, useEffect, useState } from 'react';
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

    // Handle real-time push notification (one time per trip & per bus for delay and off_route)
    socketInstance.on('notification:new', (notif) => {
      if (!notif) return;
      setRealtimeNotifications((prev) => {
        const isDuplicate = prev.some(
          (n) =>
            (n.id && notif.id && Number(n.id) === Number(notif.id)) ||
            (n.type === 'delay' &&
              notif.type === 'delay' &&
              Number(n.shuttle_id) === Number(notif.shuttle_id) &&
              !n._archivedTrip) ||
            (n.type === 'off_route' &&
              notif.type === 'off_route' &&
              Number(n.shuttle_id) === Number(notif.shuttle_id) &&
              !n._archivedTrip)
        );
        if (isDuplicate) return prev;
        setUnreadCount((c) => c + 1);
        setLatestAlert({ ...notif, _receivedAt: Date.now() });
        return [notif, ...prev];
      });
    });

    // When a new trip starts on a shuttle, allow 1 new delay and 1 new off-route alert for the new trip
    socketInstance.on('trip:status_change', ({ type, shuttleId }) => {
      if (type === 'started' && shuttleId) {
        setRealtimeNotifications((prev) =>
          prev.map((n) =>
            Number(n.shuttle_id) === Number(shuttleId) ? { ...n, _archivedTrip: true } : n
          )
        );
      }
    });

    socketInstance.on('simulation:state', ({ running }) => {
      setSimulationActive(running);
    });

    // Automatic cloud-to-local SMTP relay for Driver Schedule & Admin Emergency emails when running on Render
    socketInstance.on('email:relay', (relayPayload) => {
      if (
        relayPayload &&
        relayPayload.to &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        fetch('http://localhost:5000/api/auth/relay-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(relayPayload)
        }).catch(() => {});
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user?.role, token]);

  const relayCloudEmail = (relayPayload) => {
    if (
      relayPayload &&
      relayPayload.to &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      fetch('http://localhost:5000/api/auth/relay-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relayPayload)
      }).catch(() => {});
    }
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
      setSimulationActive(true);
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
        relayCloudEmail
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
