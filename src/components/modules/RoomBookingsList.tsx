import { useMemo, useState } from 'react';
import type { Booking, Room } from '../../lib/supabase';
import { formatBookingDate, isPastTimeSlot, slotToTimeRange } from '../../lib/roomBooking';

type BookingWithRoom = Booking & {
  room?: Room;
};

interface RoomBookingsListProps {
  bookings: BookingWithRoom[];
  onCancelBooking: (booking: BookingWithRoom) => Promise<void>;
  onBrowseRooms?: () => void;
}

export default function RoomBookingsList({
  bookings,
  onCancelBooking,
  onBrowseRooms,
}: RoomBookingsListProps) {
  const [showApprovedOnly, setShowApprovedOnly] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const visibleBookings = useMemo(
    () => bookings.filter((booking) => (showApprovedOnly ? booking.status === 'approved' : true)),
    [bookings, showApprovedOnly]
  );

  async function handleCancelBooking(booking: BookingWithRoom) {
    setCancellingId(booking.id);
    await onCancelBooking(booking);
    setCancellingId(null);
    setCancelConfirmId(null);
  }

  function getApprovalStatusDisplay(status: Booking['status']) {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'pending':
        return 'Pending Approval';
      case 'rejected':
        return 'Rejected';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }

  if (bookings.length === 0) {
    return (
      <div className="my-bookings-container">
        <h2>My Bookings</h2>
        <div className="no-bookings">
          <p>You don&apos;t have any bookings yet.</p>
          <p>Browse available rooms to make your first booking!</p>
          {onBrowseRooms && (
            <button type="button" className="clear-filters-button" onClick={onBrowseRooms}>
              Browse Rooms
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="my-bookings-container">
      <h2>My Bookings</h2>

      <div className="bookings-filter">
        <span className="filter-label">
          Showing {visibleBookings.length} booking{visibleBookings.length === 1 ? '' : 's'}
        </span>

        <div className="filter-controls">
          <button
            type="button"
            className={`approval-only-toggle ${showApprovedOnly ? 'active' : ''}`}
            onClick={() => setShowApprovedOnly((current) => !current)}
          >
            {showApprovedOnly ? 'Showing Approved Only' : 'Show Approved Bookings Only'}
          </button>
        </div>
      </div>

      <div className="bookings-list">
        {visibleBookings.length === 0 && (
          <div className="no-bookings">
            <p>No approved bookings found.</p>
            <p>Turn off the filter to see all booking statuses.</p>
          </div>
        )}

        {visibleBookings.map((booking) => {
          const range = slotToTimeRange(booking.time_slot);
          const upcoming = !isPastTimeSlot(booking.date, booking.time_slot);

          return (
            <div
              key={booking.id}
              className={`booking-item ${upcoming ? 'upcoming' : 'past'} status-${booking.status}`}
            >
              <div className="booking-item-header">
                <div className="booking-title">
                  <h3>{booking.room?.name || booking.room_id}</h3>
                  <div className="status-badges">
                    <span className={`status-badge ${booking.status}`}>
                      {getApprovalStatusDisplay(booking.status)}
                    </span>
                    <span className={`time-status-badge ${upcoming ? 'upcoming' : 'past'}`}>
                      {upcoming ? 'Upcoming' : 'Past'}
                    </span>
                  </div>
                </div>

                <div className="booking-actions">
                  {upcoming &&
                    booking.status !== 'rejected' &&
                    booking.status !== 'cancelled' &&
                    cancelConfirmId !== booking.id && (
                      <button
                        type="button"
                        className="cancel-button"
                        onClick={() => setCancelConfirmId(booking.id)}
                      >
                        Cancel
                      </button>
                    )}

                  {cancelConfirmId === booking.id && (
                    <div className="cancel-confirm">
                      <p>Are you sure?</p>
                      <button
                        type="button"
                        className="confirm-yes"
                        onClick={() => handleCancelBooking(booking)}
                        disabled={cancellingId === booking.id}
                      >
                        {cancellingId === booking.id ? 'Cancelling...' : 'Yes'}
                      </button>
                      <button
                        type="button"
                        className="confirm-no"
                        onClick={() => setCancelConfirmId(null)}
                        disabled={cancellingId === booking.id}
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="booking-details">
                <div className="detail">
                  <span className="label">Date:</span>
                  <span className="value">{formatBookingDate(booking.date)}</span>
                </div>
                <div className="detail">
                  <span className="label">Time:</span>
                  <span className="value">
                    {range.start} - {range.end}
                  </span>
                </div>
                <div className="detail">
                  <span className="label">Purpose:</span>
                  <span className="value">{booking.purpose || 'Not specified'}</span>
                </div>
                <div className="detail">
                  <span className="label">Booking ID:</span>
                  <span className="value">{booking.id}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
