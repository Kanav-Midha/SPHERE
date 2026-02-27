import { useMemo, useState } from 'react';
import type { Booking, Room } from '../../lib/supabase';
import { formatBookingDate, slotToTimeRange } from '../../lib/roomBooking';
import RoomManagementPanel from './RoomManagementPanel';

type BookingWithRoom = Booking & {
  room?: Room;
  user_email?: string;
};

interface RoomAdminPanelProps {
  bookings: BookingWithRoom[];
  rooms: Room[];
  onUpdateStatus: (
    booking: BookingWithRoom,
    status: 'approved' | 'rejected'
  ) => Promise<void>;
  onRoomsChanged: () => Promise<void>;
}

type AdminSection = 'approvals' | 'rooms';
type BookingTab = 'pending' | 'approved' | 'rejected';

export default function RoomAdminPanel({
  bookings,
  rooms,
  onUpdateStatus,
  onRoomsChanged,
}: RoomAdminPanelProps) {
  const [adminSection, setAdminSection] = useState<AdminSection>('approvals');
  const [bookingTab, setBookingTab] = useState<BookingTab>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'pending'),
    [bookings]
  );
  const approvedBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'approved'),
    [bookings]
  );
  const rejectedBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'rejected'),
    [bookings]
  );

  const visibleBookings = useMemo(() => {
    if (bookingTab === 'approved') return approvedBookings;
    if (bookingTab === 'rejected') return rejectedBookings;
    return pendingBookings;
  }, [approvedBookings, bookingTab, pendingBookings, rejectedBookings]);

  async function handleUpdate(booking: BookingWithRoom, status: 'approved' | 'rejected') {
    setProcessingId(booking.id);
    await onUpdateStatus(booking, status);
    setProcessingId(null);
  }

  return (
    <div className="admin-approval-container">
      <div className="admin-section-tabs">
        <button
          type="button"
          className={`admin-section-tab ${adminSection === 'approvals' ? 'active' : ''}`}
          onClick={() => setAdminSection('approvals')}
        >
          Booking Approvals
        </button>
        <button
          type="button"
          className={`admin-section-tab ${adminSection === 'rooms' ? 'active' : ''}`}
          onClick={() => setAdminSection('rooms')}
        >
          Manage Rooms
        </button>
      </div>

      {adminSection === 'rooms' && <RoomManagementPanel rooms={rooms} onRoomsChanged={onRoomsChanged} />}

      {adminSection === 'approvals' && (
        <>
          <div className="admin-header">
            <h2>Booking Approvals</h2>
            <span className="pending-count">{pendingBookings.length} Pending</span>
          </div>

          <div className="booking-status-tabs">
            <button
              type="button"
              className={`status-tab ${bookingTab === 'pending' ? 'active' : ''}`}
              onClick={() => setBookingTab('pending')}
            >
              Pending ({pendingBookings.length})
            </button>
            <button
              type="button"
              className={`status-tab ${bookingTab === 'approved' ? 'active' : ''}`}
              onClick={() => setBookingTab('approved')}
            >
              Approved ({approvedBookings.length})
            </button>
            <button
              type="button"
              className={`status-tab ${bookingTab === 'rejected' ? 'active' : ''}`}
              onClick={() => setBookingTab('rejected')}
            >
              Rejected ({rejectedBookings.length})
            </button>
          </div>

          {visibleBookings.length === 0 ? (
            <div className="no-pending-bookings">
              <p>
                {bookingTab === 'pending'
                  ? 'No pending booking requests.'
                  : `No ${bookingTab} bookings.`}
              </p>
            </div>
          ) : (
            <div className="pending-bookings-list">
              {visibleBookings.map((booking) => {
                const range = slotToTimeRange(booking.time_slot);

                return (
                  <div key={booking.id} className="pending-booking-card">
                    <div className="booking-card-left">
                      <div className="booking-info-block">
                        <h3 className="room-title">{booking.room?.name || booking.room_id}</h3>
                        <p className="room-location">
                          📍 {booking.room?.location || 'Campus space'}
                        </p>
                      </div>

                      <div className="booking-details-grid">
                        <div className="detail-item">
                          <span className="detail-label">Student Email:</span>
                          <span className="detail-value">{booking.user_email || booking.user_id}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Time Slot:</span>
                          <span className="detail-value">
                            {formatBookingDate(booking.date)} · {range.start} - {range.end}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Purpose:</span>
                          <span className="detail-value">{booking.purpose || 'Not specified'}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Requested:</span>
                          <span className="detail-value">
                            {new Date(booking.created_at).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {bookingTab === 'pending' && (
                      <div className="booking-card-right">
                        <button
                          type="button"
                          className="btn-approve"
                          onClick={() => handleUpdate(booking, 'approved')}
                          disabled={processingId === booking.id}
                        >
                          {processingId === booking.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="btn-reject"
                          onClick={() => handleUpdate(booking, 'rejected')}
                          disabled={processingId === booking.id}
                        >
                          {processingId === booking.id ? 'Processing...' : 'Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
