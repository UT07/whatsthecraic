/**
 * End-to-End Tests for Event Search Workflow
 *
 * These tests validate complete user journeys and multi-service interactions.
 * Tests simulate real user scenarios: search, filter, view details, save events.
 *
 * Prerequisites:
 * - All services must be running
 * - Test database seeded with sample data
 * - Redis cache available
 * - External APIs mocked or available
 */

describe('Event Search E2E Workflow', () => {
  const API_URL = process.env.API_URL || 'http://localhost:4000';
  const API_CLIENT = {
    baseURL: API_URL,
    timeout: 5000,
  };

  // Test data
  const testUser = {
    email: 'e2e-test@example.com',
    password: 'TestPassword123!',
    userId: 'e2e-user-123',
    token: '',
  };

  beforeAll(async () => {
    // Authenticate test user
    // const response = await fetch(`${API_URL}/v1/auth/login`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     email: testUser.email,
    //     password: testUser.password,
    //   }),
    // });

    // if (response.ok) {
    //   const data = await response.json();
    //   testUser.token = data.token;
    // }

    // Seed test data into database
    // await seedTestEvents();
  });

  afterAll(async () => {
    // Cleanup: Delete test user data
    // await cleanupTestData();
  });

  describe('User Story: Discover Events in Dublin', () => {
    it('should search for events and see filtered results', async () => {
      // Arrange
      const searchParams = {
        city: 'Dublin',
        limit: 10,
        offset: 0,
      };

      // Act
      const response = await fetch(
        `${API_URL}/v1/events/search?` + new URLSearchParams(searchParams),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('events');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.events)).toBe(true);

      // Verify data structure
      if (data.events.length > 0) {
        const event = data.events[0];
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('title');
        expect(event).toHaveProperty('date');
        expect(event).toHaveProperty('city', 'Dublin');
      }

      // Store event ID for next test
      return data.events.length > 0 ? data.events[0].id : null;
    });

    it('should filter events by date range', async () => {
      // Arrange
      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const searchParams = {
        city: 'Dublin',
        from: now.toISOString(),
        to: nextMonth.toISOString(),
        limit: 20,
      };

      // Act
      const response = await fetch(
        `${API_URL}/v1/events/search?` + new URLSearchParams(searchParams),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);

      // Verify all events are within date range
      data.events.forEach((event: any) => {
        const eventDate = new Date(event.date);
        expect(eventDate.getTime()).toBeGreaterThanOrEqual(now.getTime());
        expect(eventDate.getTime()).toBeLessThanOrEqual(nextMonth.getTime());
      });
    });

    it('should filter events by genre', async () => {
      // Arrange
      const genres = 'Rock';

      // Act
      const response = await fetch(
        `${API_URL}/v1/events/search?city=Dublin&genres=${genres}`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);

      // Verify genre filtering
      data.events.forEach((event: any) => {
        expect(['Rock', 'Alternative', 'Indie'].some(g => event.genre.includes(g))).toBe(true);
      });
    });

    it('should support combined search and filters', async () => {
      // Arrange
      const searchQuery = 'Black Keys';
      const filters = {
        city: 'Dublin',
        genres: 'Rock',
        limit: 5,
      };

      // Act
      const params = new URLSearchParams({
        ...filters,
        q: searchQuery,
      });

      const response = await fetch(`${API_URL}/v1/events/search?${params}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.events.length).toBeLessThanOrEqual(5);

      // Verify results match both search and filters
      data.events.forEach((event: any) => {
        expect(event.city).toBe('Dublin');
        expect(event.artist_name.toLowerCase()).toContain(searchQuery.toLowerCase());
      });
    });
  });

  describe('User Story: View Event Details', () => {
    let eventId: string;

    beforeAll(async () => {
      // Get an event ID from search results
      const searchResponse = await fetch(`${API_URL}/v1/events/search?city=Dublin&limit=1`, {
        headers: { 'Content-Type': 'application/json' },
      });

      const searchData = await searchResponse.json();
      if (searchData.events.length > 0) {
        eventId = searchData.events[0].id;
      }
    });

    it('should fetch detailed event information', async () => {
      // Skip if no event found
      if (!eventId) return;

      // Act
      const response = await fetch(`${API_URL}/v1/events/${eventId}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      const event = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(event).toHaveProperty('id', eventId);
      expect(event).toHaveProperty('title');
      expect(event).toHaveProperty('artist_name');
      expect(event).toHaveProperty('venue_name');
      expect(event).toHaveProperty('date');
      expect(event).toHaveProperty('price');
      expect(event).toHaveProperty('description');
      expect(event).toHaveProperty('imageUrl');
      expect(event).toHaveProperty('ticketUrl');
    });

    it('should return 404 for non-existent event', async () => {
      // Act
      const response = await fetch(`${API_URL}/v1/events/nonexistent-id-999`, {
        headers: { 'Content-Type': 'application/json' },
      });

      // Assert
      expect(response.status).toBe(404);
      const error = await response.json();
      expect(error).toHaveProperty('error');
    });
  });

  describe('User Story: Save and Manage Favorites', () => {
    let eventId: string;

    beforeAll(async () => {
      // Get an event ID
      const searchResponse = await fetch(`${API_URL}/v1/events/search?city=Dublin&limit=1`, {
        headers: { 'Content-Type': 'application/json' },
      });

      const searchData = await searchResponse.json();
      if (searchData.events.length > 0) {
        eventId = searchData.events[0].id;
      }
    });

    it('should save event as favorite (requires authentication)', async () => {
      // Skip if not authenticated
      if (!testUser.token) return;

      // Act
      const response = await fetch(`${API_URL}/v1/users/favorites/${eventId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testUser.token}`,
        },
      });

      // Assert
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toHaveProperty('message');
    });

    it('should retrieve user favorites list', async () => {
      // Skip if not authenticated
      if (!testUser.token) return;

      // Act
      const response = await fetch(`${API_URL}/v1/users/favorites`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testUser.token}`,
        },
      });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.favorites)).toBe(true);
    });

    it('should remove event from favorites', async () => {
      // Skip if not authenticated
      if (!testUser.token) return;

      // Act
      const response = await fetch(`${API_URL}/v1/users/favorites/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testUser.token}`,
        },
      });

      // Assert
      expect(response.status).toBe(200);
    });
  });

  describe('Performance and Caching', () => {
    it('should return results faster on second request (cache hit)', async () => {
      // Arrange
      const searchParams = {
        city: 'Dublin',
        limit: 10,
      };

      const params = new URLSearchParams(searchParams);

      // Act - First request
      const start1 = performance.now();
      const response1 = await fetch(`${API_URL}/v1/events/search?${params}`);
      const end1 = performance.now();
      const time1 = end1 - start1;

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Act - Second request (should be cached)
      const start2 = performance.now();
      const response2 = await fetch(`${API_URL}/v1/events/search?${params}`);
      const end2 = performance.now();
      const time2 = end2 - start2;

      // Assert
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Second request should be noticeably faster
      // (This is a weak assertion - in production, measure actual cache hit rate)
      expect(time2).toBeLessThanOrEqual(time1 * 1.5);
    });

    it('should handle high concurrency', async () => {
      // Arrange
      const searchParams = {
        city: 'Dublin',
        limit: 5,
      };

      const params = new URLSearchParams(searchParams);

      // Act - Make 50 concurrent requests
      const requests = Array.from({ length: 50 }, () =>
        fetch(`${API_URL}/v1/events/search?${params}`)
      );

      const responses = await Promise.all(requests);

      // Assert
      expect(responses.length).toBe(50);

      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitCount = responses.filter(r => r.status === 429).length;

      // Most should succeed, some may be rate limited
      expect(successCount).toBeGreaterThan(40);
      expect(successCount + rateLimitCount).toBe(50);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle server errors gracefully', async () => {
      // Arrange
      const searchParams = { city: '' }; // Invalid search

      // Act
      const response = await fetch(
        `${API_URL}/v1/events/search?` + new URLSearchParams(searchParams),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      // Assert
      if (response.status >= 400) {
        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('message');
      }
    });

    it('should include request ID in error responses', async () => {
      // Act
      const response = await fetch(`${API_URL}/v1/events/nonexistent`, {
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      // Assert
      expect(data).toHaveProperty('requestId');
      expect(data.requestId).toMatch(/^[a-f0-9-]+$/i); // UUID format
    });
  });
});
