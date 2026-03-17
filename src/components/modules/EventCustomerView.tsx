import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, MapPin, QrCode, Ticket, Users } from 'lucide-react';
import QRCode from 'qrcode';
import type { Event, EventTicket } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { buildTicketQrPayload } from '../../lib/eventTickets';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToastStore';
import HeroSlider3D from '../3d/HeroSlider3D';
import GlassCard from '../ui/GlassCard';
import MagneticButton from '../ui/MagneticButton';

interface EventCustomerViewProps {
  events: Event[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

function getWalletCacheKey(userId: string) {
  return `sphere-event-wallet:${userId}`;
}

function readCachedWallet(userId: string): EventTicket[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(getWalletCacheKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as EventTicket[];
  } catch {
    return [];
  }
}

function writeCachedWallet(userId: string, tickets: EventTicket[]) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getWalletCacheKey(userId), JSON.stringify(tickets));
  } catch {
    // Ignore storage quota and private mode errors.
  }
}

function mergeWalletTickets(primary: EventTicket[], fallback: EventTicket[]) {
  const merged = new Map<string, EventTicket>();

  for (const ticket of fallback) {
    merged.set(ticket.id, ticket);
  }

  for (const ticket of primary) {
    merged.set(ticket.id, ticket);
  }

  return Array.from(merged.values()).sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
}

export default function EventCustomerView({ events, loading, onRefresh }: EventCustomerViewProps) {
  const { profile } = useAuthStore();
  const { addToast } = useToastStore();
  const [wallet, setWallet] = useState<EventTicket[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [claimingEventId, setClaimingEventId] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      const cached = readCachedWallet(profile.id);
      if (cached.length > 0) {
        setWallet(cached);
        setWalletLoading(false);
      }
      void fetchWallet();
    } else {
      setWallet([]);
      setWalletLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`sphere-wallet-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_tickets',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          void fetchWallet();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  useEffect(() => {
    let active = true;

    async function generateCodes() {
      const entries = await Promise.all(
        wallet.map(async (ticket) => {
          const payload = ticket.qr_payload || buildTicketQrPayload(ticket.event_id, ticket.ticket_hash);
          const dataUrl = await QRCode.toDataURL(payload, {
            errorCorrectionLevel: 'L',
            margin: 1,
            width: 220,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });
          return [ticket.id, dataUrl] as const;
        })
      );

      if (active) {
        setQrCodes(Object.fromEntries(entries));
      }
    }

    if (wallet.length > 0) {
      void generateCodes();
    } else {
      setQrCodes({});
    }

    return () => {
      active = false;
    };
  }, [wallet]);

  useEffect(() => {
    if (profile?.id) {
      writeCachedWallet(profile.id, wallet);
    }
  }, [profile?.id, wallet]);

  async function fetchWallet() {
    if (!profile) return;

    setWalletLoading(true);
    const cachedWallet = readCachedWallet(profile.id);

    const { data, error } = await supabase
      .from('event_tickets')
      .select('id, event_id, user_id, ticket_hash, status, created_at, scanned_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      addToast({ type: 'error', title: 'Wallet Load Failed', message: error.message });
    } else {
      const tickets = (data || []) as EventTicket[];
      const eventIds = Array.from(new Set(tickets.map((ticket) => ticket.event_id)));
      let eventMap = new Map<string, NonNullable<EventTicket['events']>>();

      if (eventIds.length > 0) {
        const { data: eventRows, error: eventError } = await supabase
          .from('events')
          .select('id, title, venue, event_date')
          .in('id', eventIds);

        if (eventError) {
          addToast({ type: 'warning', title: 'Wallet Events Missing', message: eventError.message });
        } else {
          eventMap = new Map(
            (eventRows || []).map((event) => [
              event.id,
              {
                title: event.title,
                venue: event.venue,
                event_date: event.event_date,
              },
            ])
          );
        }
      }

      const normalized = tickets.map((ticket) => ({
        ...ticket,
        events: eventMap.get(ticket.event_id) || null,
        qr_payload: buildTicketQrPayload(ticket.event_id, ticket.ticket_hash),
      }));
      const nextWallet = normalized.length > 0 ? mergeWalletTickets(normalized, cachedWallet) : cachedWallet;
      setWallet(nextWallet);
      writeCachedWallet(profile.id, nextWallet);
    }

    setWalletLoading(false);
  }

  const claimedTickets = useMemo(
    () => new Map(wallet.map((ticket) => [ticket.event_id, ticket])),
    [wallet]
  );
  const selectedTicket = wallet.find((ticket) => ticket.id === selectedTicketId) || null;
  const eventMap = useMemo(
    () =>
      new Map(
        events.map((event) => [
          event.id,
          {
            title: event.title,
            venue: event.venue,
            event_date: event.event_date,
          },
        ])
      ),
    [events]
  );

  async function handleClaim(eventId: string) {
    setClaimingEventId(eventId);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      addToast({ type: 'error', title: 'Session Missing', message: 'Sign in again before claiming a ticket.' });
      setClaimingEventId(null);
      return;
    }

    const response = await fetch('/api/tickets/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ eventId }),
    });

    const payload = await response.json();

    if (!response.ok) {
      addToast({ type: 'error', title: 'Ticket Claim Failed', message: payload.error || 'Ticket claim could not be completed.' });
    } else {
      const claimedTicket = payload.ticket as EventTicket | undefined;
      if (claimedTicket) {
        setWallet((current) => {
          const nextTicket: EventTicket = {
            ...claimedTicket,
            events: eventMap.get(claimedTicket.event_id) || null,
            qr_payload: buildTicketQrPayload(claimedTicket.event_id, claimedTicket.ticket_hash),
          };

          const nextWallet = mergeWalletTickets([nextTicket], current);
          if (profile?.id) {
            writeCachedWallet(profile.id, nextWallet);
          }
          return nextWallet;
        });
      }
      addToast({
        type: 'success',
        title: 'Ticket Added to Wallet',
        message: claimedTicket?.ticket_hash
          ? `QR generated for ${claimedTicket.ticket_hash}.`
          : 'Your gate pass is ready. Show the QR to the operator at the venue.',
      });
      await onRefresh();
    }

    setClaimingEventId(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6">
        <GlassCard className="overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white text-lg font-semibold">Upcoming Events</p>
              <p className="text-white/40 text-sm mt-1">Choose an event, claim your pass, and keep it in your wallet.</p>
            </div>
            <span className="text-white/25 text-xs uppercase tracking-[0.22em]">Campus</span>
          </div>
          {loading ? (
            <div className="h-[460px] flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
            </div>
          ) : (
            <HeroSlider3D events={events} />
          )}
        </GlassCard>

        <GlassCard className="flex h-[460px] min-h-0 flex-col overflow-hidden xl:h-[500px]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Ticket size={16} style={{ color: '#dcc4a3' }} />
              <p className="text-white font-semibold">Your Passes</p>
            </div>
            <span className="text-white/25 text-[10px] uppercase tracking-[0.22em]">
              {wallet.length} total
            </span>
          </div>

          {walletLoading ? (
            <div className="flex-1 py-12 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
            </div>
          ) : wallet.length === 0 ? (
            <div className="flex-1 py-10 text-center">
              <p className="text-white font-semibold">No tickets claimed yet</p>
              <p className="text-white/40 text-sm mt-2">Reserve any event below and the access code will appear here instantly.</p>
            </div>
          ) : (
            <div className="relative flex-1 min-h-0 overflow-hidden">
              <div
                className="event-wallet-scroll h-full min-h-0 overflow-y-scroll space-y-3 pr-3 pb-16"
                tabIndex={0}
                aria-label="Your ticket wallet"
                style={{
                  height: '100%',
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-y',
                  overscrollBehavior: 'contain',
                  scrollbarGutter: 'stable both-edges',
                  scrollbarWidth: 'auto',
                }}
              >
                {wallet.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-2xl p-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-white font-semibold">{ticket.events?.title || 'Event Ticket'}</p>
                        <p className="text-white/35 text-xs mt-1">{ticket.events?.venue || 'Campus Venue'}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className="block text-[10px] uppercase tracking-[0.22em]"
                          style={{ color: ticket.status === 'used' ? '#fbbf24' : '#d9c29f' }}
                        >
                          {ticket.status}
                        </span>
                        <span className="block mt-1 text-[10px] uppercase tracking-[0.22em]" style={{ color: '#8ea07d' }}>
                          Free
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-[92px_1fr] gap-3 items-center">
                      <button
                        type="button"
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className="rounded-2xl p-2 flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                        aria-label={`Open large QR for ${ticket.events?.title || 'event ticket'}`}
                      >
                        {qrCodes[ticket.id] ? (
                          <img
                            src={qrCodes[ticket.id]}
                            alt={`${ticket.events?.title || 'Event'} QR`}
                            className="w-20 h-20 object-contain"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-xl border border-white/10 animate-pulse" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="rounded-xl px-3 py-2 font-mono text-xs break-all" style={{ background: 'rgba(220,196,163,0.08)', color: '#e6d3ba' }}>
                          {ticket.ticket_hash}
                        </div>
                        <p className="text-white/35 text-[11px] mt-2 leading-5">
                          Present this QR at the gate. The operator scanner is locked to this event and validates only this ticket.
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedTicketId(ticket.id)}
                          className="mt-2 text-xs font-medium"
                          style={{ color: '#dcc4a3' }}
                        >
                          Open full-screen QR
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
                style={{ background: 'linear-gradient(180deg, rgba(12,12,13,0), rgba(12,12,13,0.94))' }}
              />
            </div>
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
        {events.map((event) => {
          const claim = claimedTickets.get(event.id);
          const seatsLeft = Math.max(0, event.capacity - event.registered);
          const soldOut = seatsLeft === 0 && !claim;
          const eventDate = new Date(event.event_date);
          const day = eventDate.toLocaleDateString('en-US', { day: '2-digit' });
          const month = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
              <GlassCard className="h-full overflow-hidden">
                <div className="relative flex h-full min-h-[340px] flex-col">
                  <div className="absolute right-4 top-0 text-[86px] font-black leading-none text-white/[0.05] md:text-[110px]">
                    {day}
                  </div>

                  <div className="relative z-[1] flex items-start justify-between gap-4">
                    <div className="max-w-[75%]">
                      <p className="mb-3 text-[11px] uppercase tracking-[0.28em]" style={{ color: '#dcc4a3' }}>
                        {month} {day}
                      </p>
                      <h3 className="text-2xl font-bold leading-[0.95] text-white md:text-[2rem]">
                        {event.title}
                      </h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-white/45">
                      Open Event
                    </span>
                  </div>

                  <p
                    className="mt-4 max-w-2xl text-sm leading-6 text-white/56"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {event.description}
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="premium-stat p-3">
                      <div className="flex items-center gap-2 text-white/38 text-[11px] uppercase tracking-[0.2em]">
                        <MapPin size={13} style={{ color: '#dcc4a3' }} />
                        Venue
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">{event.venue}</p>
                    </div>
                    <div className="premium-stat p-3">
                      <div className="flex items-center gap-2 text-white/38 text-[11px] uppercase tracking-[0.2em]">
                        <Users size={13} style={{ color: '#dcc4a3' }} />
                        Capacity
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">{event.registered}/{event.capacity}</p>
                    </div>
                    <div className="premium-stat p-3">
                      <div className="flex items-center gap-2 text-white/38 text-[11px] uppercase tracking-[0.2em]">
                        <Calendar size={13} style={{ color: '#dcc4a3' }} />
                        Status
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">{claim ? 'Claimed' : `${seatsLeft} left`}</p>
                    </div>
                  </div>

                  <div className="mt-auto pt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {claim ? 'Pass already claimed' : soldOut ? 'This event is full' : 'Claim one free pass for this event'}
                      </p>
                      <p className="mt-2 text-xs text-white/35">
                        {claim ? `Pass code: ${claim.ticket_hash}` : 'Once claimed, the QR pass stays in your wallet until it is used.'}
                      </p>
                    </div>
                    <MagneticButton
                      size="sm"
                      disabled={walletLoading || Boolean(claim) || soldOut || claimingEventId === event.id}
                      onClick={() => handleClaim(event.id)}
                    >
                      <span className="flex items-center gap-2">
                        <QrCode size={14} />
                        {claimingEventId === event.id
                          ? 'Claiming...'
                          : walletLoading
                            ? 'Loading Wallet...'
                            : claim
                              ? 'Claimed'
                              : soldOut
                                ? 'Sold Out'
                                : 'Get Free Ticket'}
                      </span>
                    </MagneticButton>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(2,6,23,0.86)', backdropFilter: 'blur(14px)' }}
            onClick={() => setSelectedTicketId(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-[28px] p-6"
              style={{
                background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))',
                border: '1px solid rgba(148,163,184,0.2)',
                boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-white text-xl font-semibold">{selectedTicket.events?.title || 'Event Ticket'}</p>
                  <p className="text-white/45 text-sm mt-1">{selectedTicket.events?.venue || 'Campus Venue'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTicketId(null)}
                  className="text-white/45 hover:text-white text-sm"
                >
                  Close
                </button>
              </div>

              <div
                className="rounded-[24px] p-5 flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {qrCodes[selectedTicket.id] ? (
                  <img
                    src={qrCodes[selectedTicket.id]}
                    alt={`${selectedTicket.events?.title || 'Event'} large QR`}
                    className="w-full max-w-[320px] aspect-square object-contain"
                  />
                ) : (
                  <div className="w-[320px] max-w-full aspect-square rounded-2xl border border-white/10 animate-pulse" />
                )}
              </div>

              <div className="mt-5 rounded-2xl px-4 py-3" style={{ background: 'rgba(220,196,163,0.08)' }}>
                <p className="text-white/35 text-xs uppercase tracking-[0.2em]">Ticket Hash</p>
                <p className="mt-2 break-all font-mono text-base" style={{ color: '#e6d3ba' }}>{selectedTicket.ticket_hash}</p>
              </div>

              <p className="text-white/45 text-sm mt-4 leading-relaxed">
                Open this pass on one phone and use a second phone in Operator mode to scan it. If camera scan misses, the operator can still enter the hash manually.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
