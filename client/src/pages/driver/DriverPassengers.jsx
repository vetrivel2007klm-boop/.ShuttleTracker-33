import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import Card from '../../components/common/Card';
import Modal from '../../components/common/Modal';
import { Users, IdCard, Eye } from 'lucide-react';

export const DriverPassengers = () => {
  const [driverData, setDriverData] = useState(null);
  const [previewIdPassenger, setPreviewIdPassenger] = useState(null);
  const { socket } = useSocket();

  const fetchPassengers = async () => {
    try {
      const res = await api.get('/drivers/me');
      if (res.data?.success && res.data.data) {
        setDriverData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load passengers:', err);
    }
  };

  useEffect(() => {
    fetchPassengers();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handlePassengerUpdated = (updatedPassenger) => {
      if (updatedPassenger && updatedPassenger.id) {
        setDriverData((prev) => {
          if (!prev) return prev;
          const busCode = (prev.assignedShuttle?.code || 'S01').toUpperCase();
          const pBus = (updatedPassenger.bus_number || 'S01').toUpperCase();
          const existingList = prev.routePassengers || [];
          const exists = existingList.some((p) => Number(p.id) === Number(updatedPassenger.id));
          let nextList = existingList;

          if (pBus === busCode) {
            if (exists) {
              nextList = existingList.map((p) =>
                Number(p.id) === Number(updatedPassenger.id) ? { ...p, ...updatedPassenger } : p
              );
            } else {
              nextList = [...existingList, updatedPassenger];
            }
          } else if (exists) {
            nextList = existingList.filter((p) => Number(p.id) !== Number(updatedPassenger.id));
          }

          return {
            ...prev,
            routePassengers: nextList
          };
        });
      }
      fetchPassengers();
    };

    socket.on('passenger:updated', handlePassengerUpdated);
    socket.on('driver:updated', fetchPassengers);
    socket.on('shuttle:updated', fetchPassengers);
    return () => {
      socket.off('passenger:updated', handlePassengerUpdated);
      socket.off('driver:updated', fetchPassengers);
      socket.off('shuttle:updated', fetchPassengers);
    };
  }, [socket]);

  const routePassengers = driverData?.routePassengers || [];
  const busCode = driverData?.assignedShuttle?.code || 'S01';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
          Passengers
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Passenger Name, Profile Photo & Passenger ID Photo for Bus {busCode}
        </p>
      </div>

      <Card className="p-6 space-y-4 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-500" />
            <span>Passengers ({routePassengers.length})</span>
          </h3>
          <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-brand-600 dark:text-accent-blue text-xs font-extrabold">
            Bus {busCode}
          </span>
        </div>

        {routePassengers.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No passengers available.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {routePassengers.map((passenger, idx) => {
              const passengerIdCode =
                passenger.passenger_code || `PSG-${100 + Number(passenger.id || idx + 1)}`;
              const avatarSrc =
                passenger.avatar_url ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(passenger.name || 'Passenger')}`;
              const idCardSrc = passenger.id_card_url || avatarSrc;

              return (
                <div
                  key={passenger.id || idx}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3.5"
                >
                  {/* Passenger Profile Photo & Passenger Name */}
                  <div className="flex items-center gap-3.5">
                    <img
                      src={avatarSrc}
                      alt={passenger.name}
                      className="w-14 h-14 rounded-xl object-cover border-2 border-brand-500 shadow-sm shrink-0 bg-slate-900"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Passenger Name & Profile Photo
                      </span>
                      <span className="text-sm font-extrabold text-navy-900 dark:text-white block truncate mt-0.5">
                        {passenger.name}
                      </span>
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-navy-900 dark:bg-brand-600 text-white font-mono font-black text-[10px]">
                        {passengerIdCode}
                      </span>
                    </div>
                  </div>

                  {/* Passenger ID Photo */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-navy-900 dark:text-white flex items-center gap-1.5">
                        <IdCard className="w-3.5 h-3.5 text-brand-500" />
                        <span>Passenger ID Photo</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewIdPassenger(passenger)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-blue-400 hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Full ID</span>
                      </button>
                    </div>
                    <div
                      onClick={() => setPreviewIdPassenger(passenger)}
                      className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 h-32 flex items-center justify-center cursor-pointer hover:opacity-90 transition p-1.5"
                    >
                      <img
                        src={idCardSrc}
                        alt={`${passenger.name} ID Photo`}
                        className="h-full w-auto object-contain rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal: Full Passenger ID Photo & Profile Photo Preview */}
      <Modal
        isOpen={!!previewIdPassenger}
        onClose={() => setPreviewIdPassenger(null)}
        title={`Passenger ID Photo — ${previewIdPassenger?.name || ''}`}
        subtitle={`Passenger ID: ${previewIdPassenger?.passenger_code || `PSG-${100 + Number(previewIdPassenger?.id || 1)}`} • Bus ${busCode}`}
      >
        {previewIdPassenger && (
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <img
                src={
                  previewIdPassenger.avatar_url ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(previewIdPassenger.name || 'Passenger')}`
                }
                alt={previewIdPassenger.name}
                className="w-14 h-14 rounded-xl object-cover border-2 border-brand-500 shrink-0 bg-slate-900"
              />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Passenger Name
                </span>
                <span className="font-black text-navy-900 dark:text-white text-sm block">
                  {previewIdPassenger.name}
                </span>
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-navy-900 dark:bg-brand-600 text-white font-mono font-black text-[10px]">
                  {previewIdPassenger.passenger_code || `PSG-${100 + Number(previewIdPassenger.id || 1)}`}
                </span>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center p-3 max-h-[420px]">
              <img
                src={
                  previewIdPassenger.id_card_url ||
                  previewIdPassenger.avatar_url ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(previewIdPassenger.name || 'Passenger')}`
                }
                alt={`${previewIdPassenger.name} ID Photo`}
                className="max-h-[380px] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DriverPassengers;
