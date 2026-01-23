import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'student' | 'operator' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  venue: string;
  event_date: string;
  capacity: number;
  registered: number;
  image_url: string;
  tags: string[];
  organizer_id: string;
  created_at: string;
}

export interface EventAdminRecord extends Event {
  operator_auth_key?: string;
  tickets_claimed?: number;
  tickets_scanned?: number;
  invalid_scans?: number;
  already_scanned?: number;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  location: string;
  amenities: string[];
  available: boolean;
}

export interface Booking {
  id: string;
  room_id: string;
  user_id: string;
  date: string;
  time_slot: string;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
}

export interface VolunteerEvent {
  id: string;
  event_id: string;
  title: string;
  description: string;
  application_open: string;
  application_close: string;
  spots: number;
}

export interface VolunteerApplication {
  id: string;
  volunteer_event_id: string;
  user_id: string;
  full_name: string;
  email: string;
  motivation: string;
  skills: string[];
  experience: string;
  status: 'pending' | 'approved' | 'rejected';
  applied_at: string;
}

export interface VolunteerGalleryPhoto {
  id: string;
  user_id: string;
  title: string;
  caption: string;
  image_url: string;
  storage_path: string | null;
  created_at: string;
}

export interface EventTicket {
  id: string;
  event_id: string;
  user_id: string;
  ticket_hash: string;
  status: 'active' | 'used' | 'cancelled';
  created_at: string;
  scanned_at: string | null;
  qr_payload?: string;
  events?: {
    title: string;
    venue: string;
    event_date: string;
  } | null;
}

export interface OperatorSession {
  eventId: string;
  eventTitle: string;
  venue: string;
  eventDate: string;
  operatorKey: string;
}

export const allowedGoogleDomain = (import.meta.env.VITE_ALLOWED_GOOGLE_DOMAIN as string | undefined)?.toLowerCase() || 'goa.bits-pilani.ac.in';

export function getEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

export function isValidDomain(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return domain === allowedGoogleDomain;
}

export function getRoleFromEmail(email: string): UserRole {
  if (email.startsWith('admin@')) return 'admin';
  if (email.startsWith('operator@')) return 'operator';
  return 'student';
}
