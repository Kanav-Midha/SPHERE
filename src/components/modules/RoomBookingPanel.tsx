import { useEffect, useMemo, useState } from 'react';
import { supabase, type Room } from '../../lib/supabase';
import {
  formatBookingDate,
  getFirstAvailableSlot,
  getLocalDateString,
  isPastTimeSlot,
  slotToTimeRange,
} from '../../lib/roomBooking';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToastStore';
import RoomAvailabilityTimeline from './RoomAvailabilityTimeline';

interface AvailabilityRow {
  time_slot: string;
  status: string;
}

interface RoomBookingPanelProps {
  room: Room;
  templateOnly: boolean;
  onBack: () => void;
  onBookingSuccess: () => void;
}

export default function RoomBookingPanel({
  room,
  templateOnly,
  onBack,
  onBookingSuccess,
}: RoomBookingPanelProps) {
  const { profile } = useAuthStore();
  const { addToast } = useToastStore();
  const [date, setDate] = useState(getLocalDateString());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function fetchAvailability() {
      if (templateOnly) {
        setBookedSlots([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc('get_room_availability', {
        target_date: date,
        target_room_id: room.id,
      });

      if (!mounted) return;

      if (rpcError) {
        setError('Failed to fetch availability');
        setBookedSlots([]);
      } else {
        const rows = ((data || []) as AvailabilityRow[]).filter(
          (entry) => entry.status === 'approved' || entry.status === 'pending'
        );
        setBookedSlots(rows.map((entry) => entry.time_slot));
      }

      setLoading(false);
    }

    void fetchAvailability();

    return () => {
      mounted = false;
    };
  }, [date, room.id, templateOnly]);

  useEffect(() => {
    const suggestedSlot = getFirstAvailableSlot(date, bookedSlots);
    const selectedSlot = startTime && endTime ? `${startTime}-${endTime}` : '';
    const shouldResetSelection =
      !selectedSlot || bookedSlots.includes(selectedSlot) || isPastTimeSlot(date, selectedSlot);

    if (shouldResetSelection && suggestedSlot) {
      const nextRange = slotToTimeRange(suggestedSlot);
      setStartTime(nextRange.start);
      setEndTime(nextRange.end);
    }
  }, [bookedSlots, date, startTime, endTime]);

  const selectedSlot = useMemo(() => {
    if (!startTime || !endTime) return '';
    return `${startTime}-${endTime}`;
  }, [startTime, endTime]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (templateOnly) {
      setError('Booking is unavailable for this room right now.');
      return;
    }

    if (!profile) {
      setError('You need to be signed in to book a room.');
      return;
    }

    if (!selectedSlot) {
      setError('Please choose an available one-hour slot.');
      return;
    }

    setSubmitting(true);
    setError('');

    const { error: insertError } = await supabase.from('bookings').insert({
      room_id: room.id,
      user_id: profile.id,
      date,
      time_slot: selectedSlot,
      purpose: purpose.trim(),
      status: 'pending',
    });

    setSubmitting(false);

    if (insertError) {
      if (insertError.code === '23505') {
        setError('This slot is no longer available. Please choose another time.');
      } else {
        setError(insertError.message);
      }
      return;
    }

    addToast({
      type: 'success',
      title: 'Booking request submitted',
      message: `${room.name} · ${formatBookingDate(date)} · ${startTime}-${endTime}`,
    });

    setPurpose('');
    onBookingSuccess();
  }

  return (
    <div className="booking-form-container">
      <button type="button" className="back-button" onClick={onBack}>
        ← Back to Rooms
      </button>

      <div className="booking-form-card">
        <h2>Book {room.name}</h2>
        <p className="room-info">📍 {room.location || 'Location TBA'}</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="room-booking-date">Select Date</label>
            <input
              id="room-booking-date"
              type="date"
              value={date}
              min={getLocalDateString()}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>

          <div className="timeline-section">
            <h3>Room Availability for {date}</h3>
            {loading ? (
              <p className="loading-text">Loading availability...</p>
            ) : (
              <RoomAvailabilityTimeline
                selectedDate={date}
                bookedSlots={bookedSlots}
                selectedStartTime={startTime}
                selectedEndTime={endTime}
                onTimeSelect={(nextStart, nextEnd) => {
                  setStartTime(nextStart);
                  setEndTime(nextEnd);
                }}
              />
            )}
          </div>

          <div className="time-inputs">
            <div className="form-group">
              <label htmlFor="room-start-time">Start Time</label>
              <input id="room-start-time" type="time" value={startTime} readOnly required />
            </div>
            <div className="form-group">
              <label htmlFor="room-end-time">End Time</label>
              <input id="room-end-time" type="time" value={endTime} readOnly required />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="room-booking-purpose">Purpose (Optional)</label>
            <textarea
              id="room-booking-purpose"
              rows={3}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="What will you use this room for?"
            />
          </div>

          <div className="booking-summary">
            <h3>Booking Summary</h3>
            <p>
              <strong>Room:</strong> {room.name}
            </p>
            <p>
              <strong>Date:</strong> {formatBookingDate(date)}
            </p>
            <p>
              <strong>Time:</strong> {startTime && endTime ? `${startTime} - ${endTime}` : 'Select a slot'}
            </p>
            {purpose.trim() && (
              <p>
                <strong>Purpose:</strong> {purpose.trim()}
              </p>
            )}
          </div>

          <button type="submit" className="submit-button" disabled={submitting || !selectedSlot}>
            {submitting ? 'Booking...' : 'Confirm Booking'}
          </button>
        </form>
      </div>
    </div>
  );
}
