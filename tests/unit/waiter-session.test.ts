// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getActiveWaiter,
  setActiveWaiter,
  clearActiveWaiter,
  waiterHeader,
  refreshWaiterFromResponse,
} from '@/lib/waiter-session';

describe('waiter-session (client, sessionStorage, rolling 90s window)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and returns the active waiter', () => {
    setActiveWaiter('s1', 'Ana', 'tok-1');
    expect(getActiveWaiter()).toMatchObject({ staffId: 's1', staffName: 'Ana', token: 'tok-1' });
  });

  it('expires after 90 seconds of inactivity and clears storage', () => {
    setActiveWaiter('s1', 'Ana', 'tok-1');
    vi.advanceTimersByTime(90_001);
    expect(getActiveWaiter()).toBeNull();
    expect(window.sessionStorage.getItem('waiterActive')).toBeNull();
  });

  it('is still active just inside the window', () => {
    setActiveWaiter('s1', 'Ana', 'tok-1');
    vi.advanceTimersByTime(89_000);
    expect(getActiveWaiter()).not.toBeNull();
  });

  it('clearActiveWaiter removes the entry', () => {
    setActiveWaiter('s1', 'Ana', 'tok-1');
    clearActiveWaiter();
    expect(getActiveWaiter()).toBeNull();
  });

  it('survives corrupted storage without throwing', () => {
    window.sessionStorage.setItem('waiterActive', '{not json');
    expect(getActiveWaiter()).toBeNull();
  });

  it('waiterHeader attaches x-waiter-token only when a waiter is active', () => {
    expect(waiterHeader()).toEqual({});
    setActiveWaiter('s1', 'Ana', 'tok-1');
    expect(waiterHeader()).toEqual({ 'x-waiter-token': 'tok-1' });
  });

  it('refreshWaiterFromResponse rolls the window forward with the new token', () => {
    setActiveWaiter('s1', 'Ana', 'tok-1');
    vi.advanceTimersByTime(60_000); // 30s left

    const res = new Response(null, { headers: { 'x-waiter-token': 'tok-2' } });
    refreshWaiterFromResponse(res);

    vi.advanceTimersByTime(60_000); // would be expired without the refresh
    const w = getActiveWaiter();
    expect(w?.token).toBe('tok-2');
    expect(w?.staffId).toBe('s1');
  });

  it('refreshWaiterFromResponse ignores responses without a token or with no active waiter', () => {
    refreshWaiterFromResponse(new Response(null, { headers: { 'x-waiter-token': 'tok-9' } }));
    expect(getActiveWaiter()).toBeNull();

    setActiveWaiter('s1', 'Ana', 'tok-1');
    refreshWaiterFromResponse(new Response(null));
    expect(getActiveWaiter()?.token).toBe('tok-1');
  });
});
