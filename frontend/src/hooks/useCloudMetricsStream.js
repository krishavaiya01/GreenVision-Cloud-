// src/hooks/useCloudMetricsStream.js
import { useEffect, useRef, useState } from 'react';
import { connectSocket, getSocket } from '../services/realtime/socketClient';

function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

export default function useCloudMetricsStream({ onEvent } = {}) {
  const [latest, setLatest] = useState(null);
  const [latestAnomaly, setLatestAnomaly] = useState(null);
  const [connected, setConnected] = useState(false);
  const bufferRef = useRef([]);

  useEffect(() => {
    const sock = connectSocket(getToken);

    function handleMetrics(payload) {
      bufferRef.current.push(payload);
      setLatest(payload);
      onEvent && onEvent(payload, 'metric');
    }

    function handleCostAnomaly(payload) {
      setLatestAnomaly(payload);
      onEvent && onEvent(payload, 'anomaly');
    }

    function onConnect() { setConnected(true); }
    function onDisconnect() { setConnected(false); }

    sock.on('cloud:metrics', handleMetrics);
    sock.on('cloud:cost:anomaly', handleCostAnomaly);
    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);

    return () => {
      sock.off('cloud:metrics', handleMetrics);
      sock.off('cloud:cost:anomaly', handleCostAnomaly);
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
    };
  }, [onEvent]);

  return { latest, latestAnomaly, connected, buffer: bufferRef.current };
}
