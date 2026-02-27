import { useState } from 'react';
import type { Room } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../store/useToastStore';

interface RoomManagementPanelProps {
  rooms: Room[];
  onRoomsChanged: () => Promise<void>;
}

interface RoomFormState {
  name: string;
  capacity: string;
  location: string;
  amenities: string;
}

const EMPTY_FORM: RoomFormState = {
  name: '',
  capacity: '',
  location: '',
  amenities: '',
};

export default function RoomManagementPanel({
  rooms,
  onRoomsChanged,
}: RoomManagementPanelProps) {
  const { addToast } = useToastStore();
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [formData, setFormData] = useState<RoomFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  function hydrateForm(room?: Room) {
    if (!room) {
      setFormData(EMPTY_FORM);
      return;
    }

    setFormData({
      name: room.name,
      capacity: String(room.capacity),
      location: room.location || '',
      amenities: (room.amenities || []).join(', '),
    });
  }

  function updateField<K extends keyof RoomFormState>(key: K, value: RoomFormState[K]) {
    setFormData((current) => ({ ...current, [key]: value }));
  }

  function parseAmenities() {
    return formData.amenities
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  function resetForm() {
    setEditingRoomId(null);
    setIsAddingRoom(false);
    setFormData(EMPTY_FORM);
  }

  function validateForm() {
    if (!formData.name.trim()) {
      addToast({ type: 'error', title: 'Room name required' });
      return false;
    }

    if (!formData.capacity || Number(formData.capacity) <= 0) {
      addToast({ type: 'error', title: 'Capacity must be greater than 0' });
      return false;
    }

    return true;
  }

  async function createRoom() {
    if (!validateForm()) return;

    setSubmitting(true);
    const { error } = await supabase.from('rooms').insert({
      name: formData.name.trim(),
      capacity: Number(formData.capacity),
      location: formData.location.trim(),
      amenities: parseAmenities(),
      available: true,
    });
    setSubmitting(false);

    if (error) {
      addToast({ type: 'error', title: 'Failed to create room', message: error.message });
      return;
    }

    addToast({ type: 'success', title: 'Room created successfully' });
    resetForm();
    await onRoomsChanged();
  }

  async function saveRoom(roomId: string) {
    if (!validateForm()) return;

    setSubmitting(true);
    const { error } = await supabase
      .from('rooms')
      .update({
        name: formData.name.trim(),
        capacity: Number(formData.capacity),
        location: formData.location.trim(),
        amenities: parseAmenities(),
      })
      .eq('id', roomId);
    setSubmitting(false);

    if (error) {
      addToast({ type: 'error', title: 'Failed to update room', message: error.message });
      return;
    }

    addToast({ type: 'success', title: 'Room updated successfully' });
    resetForm();
    await onRoomsChanged();
  }

  async function deleteRoom(room: Room) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${room.name}? All associated bookings may also be affected.`
    );
    if (!confirmed) return;

    setSubmitting(true);
    const { error } = await supabase.from('rooms').delete().eq('id', room.id);
    setSubmitting(false);

    if (error) {
      addToast({ type: 'error', title: 'Failed to delete room', message: error.message });
      return;
    }

    addToast({ type: 'success', title: 'Room deleted successfully' });
    resetForm();
    await onRoomsChanged();
  }

  function renderForm(mode: 'create' | 'edit', roomId?: string) {
    const title = mode === 'create' ? 'Create New Room' : 'Edit Room';
    const submitLabel =
      mode === 'create' ? (submitting ? 'Creating...' : 'Create Room') : submitting ? 'Saving...' : 'Save Changes';
    const action = mode === 'create' ? createRoom : () => saveRoom(roomId!);

    return (
      <div className={mode === 'create' ? 'add-room-card' : 'edit-form'}>
        <h3>{title}</h3>

        <div className="form-group">
          <label>Room Name</label>
          <input
            value={formData.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="e.g., C308"
          />
        </div>

        <div className="form-group">
          <label>Capacity</label>
          <input
            type="number"
            min="1"
            value={formData.capacity}
            onChange={(event) => updateField('capacity', event.target.value)}
            placeholder="e.g., 40"
          />
        </div>

        <div className="form-group">
          <label>Location</label>
          <input
            value={formData.location}
            onChange={(event) => updateField('location', event.target.value)}
            placeholder="e.g., B Dome C Wing"
          />
        </div>

        <div className="form-group">
          <label>Amenities (comma-separated)</label>
          <input
            value={formData.amenities}
            onChange={(event) => updateField('amenities', event.target.value)}
            placeholder="e.g., Projector, Whiteboard"
          />
        </div>

        <div className="form-buttons">
          <button type="button" className="btn-save" onClick={action} disabled={submitting}>
            {submitLabel}
          </button>
          <button type="button" className="btn-cancel" onClick={resetForm} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="room-management-container">
      <div className="management-header">
        <h2>Manage Rooms</h2>
        <button
          type="button"
          className="btn-add-room"
          onClick={() => {
            hydrateForm();
            setIsAddingRoom(true);
            setEditingRoomId(null);
          }}
          disabled={submitting}
        >
          Add New Room
        </button>
      </div>

      {isAddingRoom && renderForm('create')}

      {rooms.length === 0 ? (
        <div className="no-rooms">
          <p>No rooms created yet.</p>
        </div>
      ) : (
        <div className="rooms-management-grid">
          {rooms.map((room) => (
            <div key={room.id} className="management-card">
              {editingRoomId === room.id ? (
                renderForm('edit', room.id)
              ) : (
                <>
                  <div className="room-info">
                    <h3>{room.name}</h3>
                    <p>
                      <strong>Capacity:</strong> {room.capacity}
                    </p>
                    <p>
                      <strong>Location:</strong> {room.location || 'Not specified'}
                    </p>
                    <div>
                      <strong>Amenities:</strong>
                      <div className="amenity-tags">
                        {(room.amenities || []).map((amenity) => (
                          <span key={amenity} className="amenity-tag">
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="management-buttons">
                    <button
                      type="button"
                      className="btn-edit"
                      onClick={() => {
                        hydrateForm(room);
                        setEditingRoomId(room.id);
                        setIsAddingRoom(false);
                      }}
                      disabled={submitting}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => deleteRoom(room)}
                      disabled={submitting}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
