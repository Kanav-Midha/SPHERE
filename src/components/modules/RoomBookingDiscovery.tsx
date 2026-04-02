import { useEffect, useMemo, useState } from 'react';
import { supabase, type Booking, type Room } from '../../lib/supabase';
import { buildReferenceRoomsView } from '../../lib/roomBooking';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToastStore';
import RoomAdminPanel from './RoomAdminPanel';
import RoomBookingPanel from './RoomBookingPanel';
import RoomBookingsList from './RoomBookingsList';
import RoomListBrowser from './RoomListBrowser';
import './room-booking-reference.css';

type RoomDiscoveryTab = 'rooms' | 'mybookings' | 'admin';

type BookingWithRoom = Booking & {
  room?: Room;
  user_email?: string;
};

const STUDENT_TABS: Array<{ id: Exclude<RoomDiscoveryTab, 'admin'>; label: string }> = [
  { id: 'rooms', label: 'Browse Rooms' },
  { id: 'mybookings', label: 'My Bookings' },
];

const ADMIN_TAB = { id: 'admin' as const, label: 'Admin Panel' };

export default function RoomBookingDiscovery() {
  const { profile } = useAuthStore();
  const { addToast } = useToastStore();
  const [databaseRooms, setDatabaseRooms] = useState<Room[]>([]);
  const [visibleRooms, setVisibleRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [myBookings, setMyBookings] = useState<BookingWithRoom[]>([]);
  const [adminBookings, setAdminBookings] = useState<BookingWithRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [usingTemplateRooms, setUsingTemplateRooms] = useState(false);
  const [activeTab, setActiveTab] = useState<RoomDiscoveryTab>('rooms');

  const availableTabs = useMemo(() => {
    if (profile?.role === 'admin') {
      return [...STUDENT_TABS, ADMIN_TAB];
    }

    return STUDENT_TABS;
  }, [profile?.role]);

  async function fetchRoomData() {
    setLoadingRooms(true);

    const roomQuery = supabase.from('rooms').select('*').order('name');
    const bookingQuery = profile
      ? supabase
          .from('bookings')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as Booking[] });

    const adminBookingQuery =
      profile?.role === 'admin'
        ? supabase.from('bookings').select('*').order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as Booking[] });

    const [roomResponse, bookingResponse, adminResponse] = await Promise.all([
      roomQuery,
      bookingQuery,
      adminBookingQuery,
    ]);

    const resolvedDatabaseRooms = (roomResponse.data as Room[]) || [];
    const resolvedVisibleRooms = buildReferenceRoomsView(resolvedDatabaseRooms);
    const templateOnly = false;

    const roomById = new Map(
      [...resolvedDatabaseRooms, ...resolvedVisibleRooms].map((room) => [room.id, room] as const)
    );

    const resolvedMyBookings = ((bookingResponse.data as Booking[]) || []).map((booking) => ({
      ...booking,
      room: roomById.get(booking.room_id),
      user_email: profile?.email,
    }));

    let resolvedAdminBookings: BookingWithRoom[] = [];

    if (profile?.role === 'admin') {
      const allBookings = (adminResponse.data as Booking[]) || [];
      const uniqueUserIds = Array.from(new Set(allBookings.map((booking) => booking.user_id)));
      const { data: profilesData } =
        uniqueUserIds.length > 0
          ? await supabase.from('profiles').select('id, email').in('id', uniqueUserIds)
          : { data: [] };

      const emailById = new Map(
        ((profilesData || []) as { id: string; email: string }[]).map((item) => [
          item.id,
          item.email,
        ])
      );

      resolvedAdminBookings = allBookings.map((booking) => ({
        ...booking,
        room: roomById.get(booking.room_id),
        user_email: emailById.get(booking.user_id),
      }));
    }

    setDatabaseRooms(resolvedDatabaseRooms);
    setVisibleRooms(resolvedVisibleRooms);
    setUsingTemplateRooms(templateOnly);
    setMyBookings(resolvedMyBookings);
    setAdminBookings(resolvedAdminBookings);
    setLoadingRooms(false);
  }

  useEffect(() => {
    void fetchRoomData();
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    if (activeTab === 'admin' && profile?.role !== 'admin') {
      setActiveTab('rooms');
    }
  }, [activeTab, profile?.role]);

  async function cancelBooking(booking: BookingWithRoom) {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id);

    if (error) {
      addToast({
        type: 'error',
        title: 'Cancellation failed',
        message: error.message,
      });
      return;
    }

    addToast({
      type: 'success',
      title: 'Booking cancelled',
      message: booking.room?.name || 'Room booking cancelled',
    });
    await fetchRoomData();
  }

  async function updateAdminBookingStatus(
    booking: BookingWithRoom,
    status: 'approved' | 'rejected'
  ) {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', booking.id);

    if (error) {
      addToast({
        type: 'error',
        title: 'Update failed',
        message: error.message,
      });
      return;
    }

    addToast({
      type: 'success',
      title: status === 'approved' ? 'Booking approved' : 'Booking rejected',
      message: booking.room?.name || booking.id,
    });
    await fetchRoomData();
  }

  return (
    <div className="rb-reference-app">
      <header className="app-header">
        <div className="header-controls">
          <div className="user-session-card">
            <div className="user-session-info">
              <p className="user-name">{profile?.full_name || 'BITS Goa User'}</p>
              <p className="user-email">{profile?.email || 'goa.bits-pilani.ac.in'}</p>
            </div>
            <button className="logout-button" type="button" disabled>
              Room Booking
            </button>
          </div>
        </div>
      </header>

      <nav className="app-nav">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`nav-button ${activeTab === tab.id ? 'active' : ''} ${
              tab.id === 'admin' ? 'admin-button' : ''
            }`}
            onClick={() => {
              setSelectedRoom(null);
              setActiveTab(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {activeTab === 'rooms' &&
          (selectedRoom ? (
            <RoomBookingPanel
              room={selectedRoom}
              templateOnly={usingTemplateRooms}
              onBack={() => setSelectedRoom(null)}
              onBookingSuccess={async () => {
                setSelectedRoom(null);
                setActiveTab('mybookings');
                await fetchRoomData();
              }}
            />
          ) : (
            <RoomListBrowser
              rooms={visibleRooms}
              loading={loadingRooms}
              templateOnly={usingTemplateRooms}
              onSelectRoom={setSelectedRoom}
            />
          ))}

        {activeTab === 'mybookings' && (
          <RoomBookingsList
            bookings={myBookings}
            onCancelBooking={cancelBooking}
            onBrowseRooms={() => setActiveTab('rooms')}
          />
        )}

        {activeTab === 'admin' && profile?.role === 'admin' && (
          <RoomAdminPanel
            bookings={adminBookings}
            rooms={databaseRooms}
            onUpdateStatus={updateAdminBookingStatus}
            onRoomsChanged={fetchRoomData}
          />
        )}
      </main>
    </div>
  );
}
