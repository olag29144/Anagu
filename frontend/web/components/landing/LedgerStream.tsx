'use client';

import { useState, useEffect } from 'react';
import { Layers, CheckCircle2, ShieldCheck, Activity, Hash, ArrowUpRight } from 'lucide-react';

interface LedgerEvent {
  id: string;
  blockNumber: number;
  eventType: 'TITLE_MINTED' | 'SPATIAL_CLEARANCE' | 'ORACLE_ATTESTATION' | 'GOVERNOR_CONSENT';
  entityId: string;
  location: string;
  actor: string;
  timestamp: string;
  txHash: string;
}

const INITIAL_EVENTS: LedgerEvent[] = [
  {
    id: 'evt-1',
    blockNumber: 1048292,
    eventType: 'TITLE_MINTED',
    entityId: 'NG-LAG-VI-2024-0042',
    location: 'Victoria Island, Lagos',
    actor: 'Land Registrar (0x9a81...4b02)',
    timestamp: 'Just now',
    txHash: '0x8f2d9c104a3b81ef56934c910321a55b38f29104',
  },
  {
    id: 'evt-2',
    blockNumber: 1048291,
    eventType: 'SPATIAL_CLEARANCE',
    entityId: 'NG-ABJ-GWA-2024-0311',
    location: 'Gwarinpa, Abuja FCT',
    actor: 'PostGIS Automated Spatial Engine',
    timestamp: '1 min ago',
    txHash: '0x19ba40192a0134bc59812ea9941038910471b02',
  },
  {
    id: 'evt-3',
    blockNumber: 1048290,
    eventType: 'ORACLE_ATTESTATION',
    entityId: 'NG-OGN-OTA-2024-0109',
    location: 'Ado-Odo Ota, Ogun State',
    actor: 'Dual-Oracle (Ministry & Traditional Council)',
    timestamp: '3 mins ago',
    txHash: '0x4f89d317ac2091b654e8103c8091da93fe883a66',
  },
  {
    id: 'evt-4',
    blockNumber: 1048289,
    eventType: 'GOVERNOR_CONSENT',
    entityId: 'NG-ENU-GRA-2024-0077',
    location: 'Independence Layout, Enugu',
    actor: 'Executive Governor Custody Key',
    timestamp: '5 mins ago',
    txHash: '0x71ba9045ef12998a442b01c389104441029cba6',
  },
  {
    id: 'evt-5',
    blockNumber: 1048288,
    eventType: 'SPATIAL_CLEARANCE',
    entityId: 'NG-RIV-GRA-2024-0156',
    location: 'Old GRA, Port Harcourt, Rivers',
    actor: 'SURCON Surveyor Field Node (0x33e1...12a9)',
    timestamp: '8 mins ago',
    txHash: '0x9941038910471b028f2d9c104a3b81ef56934c9',
  },
];

export function LedgerStream() {
  const [events, setEvents] = useState<LedgerEvent[]>(INITIAL_EVENTS);
  const [currentBlock, setCurrentBlock] = useState(1048292);

  // Periodic block tick to simulate live IBFT 2.0 block finality
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBlock((prev) => {
        const nextBlock = prev + 1;
        const newEvt: LedgerEvent = {
          id: `evt-${Date.now()}`,
          blockNumber: nextBlock,
          eventType: Math.random() > 0.5 ? 'SPATIAL_CLEARANCE' : 'ORACLE_ATTESTATION',
          entityId: `NG-CAD-${Math.floor(Math.random() * 8999 + 1000)}`,
          location: 'State Survey Grid Node Sector ' + Math.floor(Math.random() * 8 + 1),
          actor: 'Automated Besu Consensus Node',
          timestamp: 'Just now',
          txHash: `0x${Math.random().toString(16).substring(2, 14)}${Math.random().toString(16).substring(2, 14)}`,
        };

        setEvents((prevEvents) => [newEvt, ...prevEvents.slice(0, 5)]);
        return nextBlock;
      });
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  const getEventBadge = (type: LedgerEvent['eventType']) => {
    switch (type) {
      case 'TITLE_MINTED':
        return {
          label: 'TITLE DEED MINTED',
          style: 'bg-[#020305] text-[#38BDF8] border-[rgba(56,189,248,0.30)]',
        };
      case 'SPATIAL_CLEARANCE':
        return {
          label: 'POSTGIS CLEARANCE',
          style: 'bg-[#020305] text-[#67E8F9] border-[rgba(103,232,249,0.30)]',
        };
      case 'ORACLE_ATTESTATION':
        return {
          label: 'ORACLE QUORUM',
          style: 'bg-[#020305] text-emerald-400 border-emerald-500/30',
        };
      case 'GOVERNOR_CONSENT':
        return {
          label: 'GOVERNOR RATIFICATION',
          style: 'bg-[#020305] text-amber-400 border-amber-500/30',
        };
    }
  };

  return (
    <section id="ledger" className="py-20 sm:py-28 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A0F16] border border-[rgba(91,133,167,0.20)] mb-3">
              <Activity className="h-3.5 w-3.5 text-[#38BDF8]" />
              <span className="text-[12px] font-mono uppercase tracking-wider text-[#67E8F9]">
                Live Consensus Feed
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#F4F7FB] tracking-tight">
              Real-Time Sovereign Ledger Activity
            </h2>
            <p className="text-[#94A3B8] text-base mt-2 max-w-xl">
              Cryptographic transactions recorded by consortium validator nodes across the federation.
            </p>
          </div>

          {/* Current Block Status Pill */}
          <div className="rounded-[10px] bg-[#0A0F16] border border-[rgba(56,189,248,0.25)] p-4 flex items-center gap-4 shrink-0 shadow-[0_0_20px_rgba(56,189,248,0.06)]">
            <div className="h-3 w-3 rounded-full bg-[#38BDF8] animate-ping" />
            <div>
              <p className="text-[11px] font-mono uppercase text-[#526174]">
                Current Besu Block
              </p>
              <p className="text-lg font-mono font-bold text-[#F4F7FB]">
                #{currentBlock.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Ledger Event Table / List */}
        <div className="rounded-[12px] bg-[#0A0F16]/80 border border-[rgba(91,133,167,0.20)] overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[rgba(91,133,167,0.15)] text-left text-xs font-mono">
              <thead className="bg-[#05080D]/90 text-[#526174] uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-4">Block #</th>
                  <th scope="col" className="px-6 py-4">Event Type</th>
                  <th scope="col" className="px-6 py-4">Cadastral Ref</th>
                  <th scope="col" className="px-6 py-4">Location</th>
                  <th scope="col" className="px-6 py-4">Authority / Node</th>
                  <th scope="col" className="px-6 py-4">Time</th>
                  <th scope="col" className="px-6 py-4 text-right">Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(91,133,167,0.10)] text-[#94A3B8]">
                {events.map((evt) => {
                  const badge = getEventBadge(evt.eventType);
                  return (
                    <tr
                      key={evt.id}
                      className="hover:bg-[#0D141D]/70 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-[#F4F7FB] font-semibold">
                        #{evt.blockNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold border ${badge.style}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[#F4F7FB]">
                        {evt.entityId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[#94A3B8]">
                        {evt.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[#526174]">
                        {evt.actor}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-[#526174]">
                        {evt.timestamp}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-[#38BDF8] hover:text-[#67E8F9] inline-flex items-center gap-1 cursor-pointer">
                          <span>{evt.txHash.substring(0, 8)}...</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
