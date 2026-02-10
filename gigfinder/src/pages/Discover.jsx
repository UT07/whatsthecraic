import React, { useEffect, useState } from "react";
import { fetchEvents } from "../services/aggregatorAPI";

const Discover = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetchEvents().then(setEvents);
  }, []);

  return (
    <div className="p-5">
      <h1 className="text-2xl font-bold">Discover Gigs</h1>
      <ul className="mt-5">
        {events.map((event) => (
          <li key={event.id} className="p-3 bg-gray-800 mb-2 rounded">
            {event.event_name} - {event.city} - {event.date_local}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Discover;
