import { BOOKING_HOURS, buildTimeSlot, formatHour, isPastTimeSlot } from '../../lib/roomBooking';

interface RoomAvailabilityTimelineProps {
  selectedDate: string;
  bookedSlots: string[];
  selectedStartTime: string;
  selectedEndTime: string;
  onTimeSelect: (start: string, end: string) => void;
}

export default function RoomAvailabilityTimeline({
  selectedDate,
  bookedSlots,
  selectedStartTime,
  onTimeSelect,
}: RoomAvailabilityTimelineProps) {
  return (
    <div className="timeline-container">
      <div className="timeline-legend">
        <div className="legend-item">
          <div className="legend-box available"></div>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <div className="legend-box booked"></div>
          <span>Booked</span>
        </div>
        <div className="legend-item">
          <div className="legend-box past"></div>
          <span>Past</span>
        </div>
        <div className="legend-item">
          <div className="legend-box selected"></div>
          <span>Selected</span>
        </div>
      </div>

      <div className="timeline">
        {BOOKING_HOURS.map((hour) => {
          const slot = buildTimeSlot(hour);
          const start = formatHour(hour);
          const end = formatHour(hour + 1);
          const booked = bookedSlots.includes(slot);
          const past = isPastTimeSlot(selectedDate, slot);
          const isSelected = selectedStartTime === start;
          const isUnavailable = booked || past;

          return (
            <div key={slot} className="hour-block">
              <div className="hour-label">{`${start}-${end}`}</div>
              <div
                className={`time-slot hour-slot ${booked ? 'booked' : 'available'} ${
                  past ? 'past' : ''
                } ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  if (!isUnavailable) {
                    onTimeSelect(start, end);
                  }
                }}
                title={`${start} to ${end}`}
              >
                1 hr
              </div>
            </div>
          );
        })}
      </div>

      <p className="timeline-hint">
        Click an available future slot to book a fixed 1-hour session.
      </p>
    </div>
  );
}
