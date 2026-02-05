import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, MapPin, Sparkles, Users } from 'lucide-react';
import type { Room } from '../../lib/supabase';

interface RoomListBrowserProps {
  rooms: Room[];
  loading: boolean;
  templateOnly: boolean;
  onSelectRoom: (room: Room) => void;
}

export default function RoomListBrowser({
  rooms,
  loading,
  templateOnly,
  onSelectRoom,
}: RoomListBrowserProps) {
  const [locationFilter, setLocationFilter] = useState('all');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [minCapacity, setMinCapacity] = useState(0);
  const [maxCapacity, setMaxCapacity] = useState(0);
  const [showCapacityPanel, setShowCapacityPanel] = useState(false);
  const capacityPanelRef = useRef<HTMLDivElement>(null);

  const capacityBounds = useMemo(() => {
    const capacities = rooms
      .map((room) => Number(room.capacity))
      .filter((capacity) => Number.isFinite(capacity) && capacity > 0);

    if (capacities.length === 0) {
      return { min: 0, max: 0 };
    }

    return {
      min: Math.min(...capacities),
      max: Math.max(...capacities),
    };
  }, [rooms]);

  useEffect(() => {
    setMinCapacity(capacityBounds.min);
    setMaxCapacity(capacityBounds.max);
  }, [capacityBounds.min, capacityBounds.max]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        capacityPanelRef.current &&
        !capacityPanelRef.current.contains(event.target as Node)
      ) {
        setShowCapacityPanel(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const availableAmenities = useMemo(() => {
    const allAmenities = rooms.flatMap((room) => room.amenities || []);
    return [...new Set(allAmenities)].sort((a, b) => a.localeCompare(b));
  }, [rooms]);

  const availableLocations = useMemo(() => {
    const allLocations = rooms
      .map((room) => (room.location || '').trim())
      .filter((location) => location.length > 0);

    return [...new Set(allLocations)].sort((a, b) => a.localeCompare(b));
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const roomCapacity = Number(room.capacity) || 0;
      const roomLocation = (room.location || '').trim();
      const roomAmenities = room.amenities || [];

      const matchesCapacity = roomCapacity >= minCapacity && roomCapacity <= maxCapacity;
      const matchesLocation = locationFilter === 'all' || roomLocation === locationFilter;
      const matchesAmenities = selectedAmenities.every((amenity) => roomAmenities.includes(amenity));

      return matchesCapacity && matchesLocation && matchesAmenities;
    });
  }, [rooms, minCapacity, maxCapacity, locationFilter, selectedAmenities]);

  function handleAmenityToggle(amenity: string) {
    setSelectedAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity]
    );
  }

  function clearFilters() {
    setMinCapacity(capacityBounds.min);
    setMaxCapacity(capacityBounds.max);
    setLocationFilter('all');
    setSelectedAmenities([]);
    setShowCapacityPanel(false);
  }

  function getRoomMood(room: Room) {
    const amenities = room.amenities || [];

    if (amenities.some((item) => /lab|computers/i.test(item)) || /lab/i.test(room.name)) {
      return 'Technical setup';
    }

    if (amenities.some((item) => /projector|smartboard/i.test(item))) {
      return 'Presentation ready';
    }

    if (room.capacity <= 10) {
      return 'Small-group focus';
    }

    return 'Flexible campus space';
  }

  function getRoomAccent(index: number) {
    const accents = ['sage', 'clay', 'sand', 'wine'];
    return accents[index % accents.length];
  }

  return (
    <div className="room-list-container">
      <div className="room-browser-header">
        <div>
          <p className="room-browser-kicker">BITS Goa room browser</p>
          <h2>Available Rooms</h2>
        </div>
        <p className="room-browser-copy">
          Choose a room, review its setup, and move straight into a one-hour booking slot.
        </p>
      </div>

      <div className="room-filters">
        <div className="filters-heading">
          <div>
            <p className="filters-kicker">Refine the list</p>
            <h3>Find the right space quickly</h3>
          </div>
          <p>
            Filter by capacity, block, and setup instead of scrolling through identical cards.
          </p>
        </div>

        <div className="filters-row">
          <div className="filter-group capacity-filter-popover" ref={capacityPanelRef}>
            <label htmlFor="room-capacity-filter">Capacity Range</label>
            <button
              id="room-capacity-filter"
              type="button"
              className="capacity-toggle-button"
              aria-expanded={showCapacityPanel}
              onClick={() => setShowCapacityPanel((current) => !current)}
            >
              {`Capacity: ${minCapacity} - ${maxCapacity}`}
            </button>

            {showCapacityPanel && (
              <div className="capacity-dropdown-panel">
                <div className="capacity-values">
                  <span>Min: {minCapacity}</span>
                  <span>Max: {maxCapacity}</span>
                </div>

                <div className="capacity-sliders">
                  <input
                    type="range"
                    min={capacityBounds.min}
                    max={capacityBounds.max}
                    value={minCapacity}
                    disabled={capacityBounds.min === capacityBounds.max}
                    onChange={(event) => {
                      const nextMin = Number(event.target.value);
                      setMinCapacity(Math.min(nextMin, maxCapacity));
                    }}
                  />
                  <input
                    type="range"
                    min={capacityBounds.min}
                    max={capacityBounds.max}
                    value={maxCapacity}
                    disabled={capacityBounds.min === capacityBounds.max}
                    onChange={(event) => {
                      const nextMax = Number(event.target.value);
                      setMaxCapacity(Math.max(nextMax, minCapacity));
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="filter-group">
            <label htmlFor="location-filter">Location</label>
            <select
              id="location-filter"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
            >
              <option value="all">All locations</option>
              {availableLocations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="clear-filters-button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>

        {availableAmenities.length > 0 && (
          <div className="amenities-filter-group">
            <p className="amenities-filter-title">Amenities</p>
            <div className="amenities-filter-options">
              {availableAmenities.map((amenity) => (
                <label key={amenity} className="amenity-filter-option">
                  <input
                    type="checkbox"
                    checked={selectedAmenities.includes(amenity)}
                    onChange={() => handleAmenityToggle(amenity)}
                  />
                  <span>{amenity}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading">Loading rooms...</div>
      ) : (
        <>
          <div className="room-grid">
            {filteredRooms.map((room, index) => (
              <div
                key={room.id}
                className={`room-card room-card--${getRoomAccent(index)}`}
              >
                <div className="room-card-header">
                  <div className="room-card-header-top">
                    <span className="room-card-kicker">Campus Room</span>
                    <span className="capacity-badge">
                      <Users size={14} />
                      {room.capacity}
                    </span>
                  </div>

                  <div className="room-card-visual">
                    <div className="room-card-orbit room-card-orbit-a" />
                    <div className="room-card-orbit room-card-orbit-b" />
                    <div className="room-card-gridline room-card-gridline-a" />
                    <div className="room-card-gridline room-card-gridline-b" />
                    <div className="room-card-title-wrap">
                      <h3>{room.name}</h3>
                      <p>{getRoomMood(room)}</p>
                    </div>
                  </div>
                </div>

                <div className="room-card-body">
                  <div className="room-detail-row">
                    <span className="room-detail-label">Location</span>
                    <p className="room-detail-value">
                      <MapPin size={14} />
                      {room.location || 'N/A'}
                    </p>
                  </div>

                  {!!room.amenities?.length && (
                    <div className="amenities">
                      <div className="room-detail-row">
                        <span className="room-detail-label">Amenities</span>
                        <p className="room-detail-value subtle">
                          <Sparkles size={14} />
                          {room.amenities.length} features
                        </p>
                      </div>
                      <div className="amenity-tags">
                        {room.amenities.map((amenity) => (
                          <span key={amenity} className="amenity-tag">
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="room-card-button"
                  onClick={() => onSelectRoom(room)}
                >
                  <span>Book Room</span>
                  <ArrowUpRight size={16} />
                </button>
              </div>
            ))}
          </div>

          {rooms.length === 0 && (
            <div className="no-rooms">
              <p>No rooms available</p>
            </div>
          )}

          {rooms.length > 0 && filteredRooms.length === 0 && (
            <div className="no-rooms">
              <p>No rooms match your selected filters.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
