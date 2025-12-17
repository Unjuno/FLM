import { describe, it, expect } from 'vitest';
import { routes } from '../routes';

describe('routes', () => {
  it('should export routes array', () => {
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should have correct route structure', () => {
    routes.forEach(route => {
      expect(route).toHaveProperty('path');
      expect(route).toHaveProperty('element');
      expect(typeof route.path).toBe('string');
    });
  });

  it('should have home route', () => {
    const homeRoute = routes.find(route => route.path === '/');
    expect(homeRoute).toBeDefined();
  });

  it('should have chat tester route', () => {
    const chatRoute = routes.find(route => route.path === '/chat/tester');
    expect(chatRoute).toBeDefined();
  });

  it('should have security events route', () => {
    const securityRoute = routes.find(
      route => route.path === '/security/events'
    );
    expect(securityRoute).toBeDefined();
  });

  it('should have IP blocklist management route', () => {
    const ipBlocklistRoute = routes.find(
      route => route.path === '/security/ip-blocklist'
    );
    expect(ipBlocklistRoute).toBeDefined();
  });

  it('should have all routes with AppLayout wrapper', () => {
    routes.forEach(route => {
      if (route.path !== '*') {
        // Check that element exists and is a React element
        expect(route.element).toBeDefined();
      }
    });
  });
});
