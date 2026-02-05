import type { Room } from './supabase';

export const BOOKING_START_HOUR = 8;
export const BOOKING_END_HOUR = 23;

export const BOOKING_HOURS = Array.from(
  { length: BOOKING_END_HOUR - BOOKING_START_HOUR },
  (_, index) => BOOKING_START_HOUR + index
);

export interface ReferenceRoomSeed {
  name: string;
  capacity: number;
  location: string;
  amenities: string[];
}

export const REFERENCE_ROOMS: ReferenceRoomSeed[] = [
  {
    name: 'A 506',
    capacity: 40,
    location: 'B Dome A Wing',
    amenities: ['Projector', 'Blackboard'],
  },
  {
    name: 'C 308',
    capacity: 40,
    location: 'B Dome C Wing',
    amenities: ['Projector', 'Whiteboard'],
  },
  {
    name: 'CC Lab',
    capacity: 250,
    location: 'Computer Centre',
    amenities: ['Computers', 'Lab Equipment'],
  },
  {
    name: 'DLT 8',
    capacity: 300,
    location: 'Lecture Theatre Complex',
    amenities: ['Projector', 'Smartboard'],
  },
  {
    name: "Hemu's Cuckpit",
    capacity: 3,
    location: 'Faculty Block',
    amenities: ['Whiteboard'],
  },
];

export function normalizeRoomName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildReferenceRoomsView(existingRooms: Room[]) {
  const roomByName = new Map(
    existingRooms.map((room) => [normalizeRoomName(room.name), room] as const)
  );
  const orderedReferenceRooms = REFERENCE_ROOMS.map((seed) =>
    roomByName.get(normalizeRoomName(seed.name))
  ).filter((room): room is Room => Boolean(room));

  const referenceNames = new Set(REFERENCE_ROOMS.map((room) => normalizeRoomName(room.name)));
  const customRooms = existingRooms.filter(
    (room) => !referenceNames.has(normalizeRoomName(room.name))
  );

  return [...orderedReferenceRooms, ...customRooms];
}

export function areAllReferenceRoomsSeeded(existingRooms: Room[]) {
  const roomNames = new Set(existingRooms.map((room) => normalizeRoomName(room.name)));
  return REFERENCE_ROOMS.every((room) => roomNames.has(normalizeRoomName(room.name)));
}

export function formatHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function buildTimeSlot(hour: number) {
  return `${formatHour(hour)}-${formatHour(hour + 1)}`;
}

export function getLocalDateString(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextBookableSlot(date: string) {
  const today = new Date();
  const isToday = date === getLocalDateString(today);
  const minimumHour = isToday
    ? Math.max(
        BOOKING_START_HOUR,
        today.getHours() + (today.getMinutes() > 0 || today.getSeconds() > 0 ? 1 : 0)
      )
    : BOOKING_START_HOUR;

  if (minimumHour >= BOOKING_END_HOUR) {
    return null;
  }

  return buildTimeSlot(minimumHour);
}

export function getFirstAvailableSlot(date: string, bookedSlots: string[]) {
  const booked = new Set(bookedSlots);

  for (const hour of BOOKING_HOURS) {
    const candidate = buildTimeSlot(hour);
    if (!booked.has(candidate) && !isPastTimeSlot(date, candidate)) {
      return candidate;
    }
  }

  return '';
}

export function slotStartHour(timeSlot: string) {
  const [start] = timeSlot.split('-');
  const [hour] = start.split(':');
  return Number(hour);
}

export function slotToTimeRange(timeSlot: string) {
  const [start = '', end = ''] = timeSlot.split('-');
  return { start, end };
}

export function isPastTimeSlot(date: string, timeSlot: string) {
  const slotHour = slotStartHour(timeSlot);
  const slotDate = new Date(`${date}T${String(slotHour).padStart(2, '0')}:00:00`);
  return slotDate <= new Date();
}

export function formatBookingDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
