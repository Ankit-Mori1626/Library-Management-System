import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, session, hue, fmt, loanState } from '../api';
import { mockFetch, DAY } from './helpers';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

describe('hue()', () => {
  it('always returns a colour angle between 0 and 359', () => {
    for (const s of ['Clean Code', 'A', '', 'The Alchemist', 'ऑल इंडिया']) {
      const h = hue(s);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  it('gives the same colour for the same title every time', () => {
    expect(hue('Sapiens')).toBe(hue('Sapiens'));
  });

  it('gives different colours to different titles', () => {
    expect(hue('Sapiens')).not.toBe(hue('Deep Work'));
  });
});

describe('fmt()', () => {
  it('formats a date as day, short month, year', () => {
    expect(fmt(new Date(2026, 10, 5))).toBe('5 Nov 2026');
  });
});

describe('loanState()', () => {
  it('shows returned loans in green with the return date', () => {
    const [colour, label] = loanState({ returnedAt: new Date(2026, 0, 10) });
    expect(colour).toBe('ok');
    expect(label).toBe('Returned 10 Jan 2026');
  });

  it('shows overdue loans in red (plural days)', () => {
    const [colour, label] = loanState({ dueAt: Date.now() - 1.5 * DAY });
    expect(colour).toBe('no');
    expect(label).toBe('Overdue by 2 days');
  });

  it('uses "day" (singular) for one day overdue', () => {
    expect(loanState({ dueAt: Date.now() - 0.5 * DAY })[1]).toBe('Overdue by 1 day');
  });

  it('warns when the book is due within 3 days', () => {
    const [colour, label] = loanState({ dueAt: Date.now() + 1.5 * DAY });
    expect(colour).toBe('warn');
    expect(label).toBe('Due in 2 days');
  });

  it('shows normal loans in green with the due date', () => {
    const due = Date.now() + 10 * DAY;
    const [colour, label] = loanState({ dueAt: due });
    expect(colour).toBe('ok');
    expect(label).toBe('Due ' + fmt(due));
  });
});

describe('session storage helper', () => {
  it('remember = true keeps the value in localStorage', () => {
    session.set('token', 'abc', true);
    expect(localStorage.getItem('token')).toBe('abc');
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('remember = false keeps the value in sessionStorage only', () => {
    session.set('token', 'abc', false);
    expect(sessionStorage.getItem('token')).toBe('abc');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('get() finds the value in either place', () => {
    session.set('a', '1', true);
    session.set('b', '2', false);
    expect(session.get('a')).toBe('1');
    expect(session.get('b')).toBe('2');
    expect(session.get('missing')).toBeNull();
  });

  it('clear() empties both', () => {
    session.set('a', '1', true);
    session.set('b', '2', false);
    session.clear();
    expect(session.get('a')).toBeNull();
    expect(session.get('b')).toBeNull();
  });
});

describe('api()', () => {
  it('calls /api + path and returns the JSON', async () => {
    const calls = mockFetch({ 'GET /books': [{ title: 'X' }] });
    const data = await api('/books');
    expect(data).toEqual([{ title: 'X' }]);
    expect(calls[0].url).toBe('/api/books');
    expect(calls[0].method).toBe('GET');
  });

  it('sends the saved token as a Bearer header', async () => {
    session.set('token', 'my-token', true);
    const calls = mockFetch();
    await api('/loans');
    expect(calls[0].headers.Authorization).toBe('Bearer my-token');
  });

  it('sends the body as JSON for POST requests', async () => {
    const calls = mockFetch({ 'POST /loans': { ok: true } });
    await api('/loans', 'POST', { bookId: 'b1' });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toEqual({ bookId: 'b1' });
  });

  it('throws the server message when the request fails', async () => {
    mockFetch({ 'POST /auth/login': { error: 'Wrong email or password' } });
    await expect(api('/auth/login', 'POST', {})).rejects.toThrow('Wrong email or password');
  });

  it('throws a default message when the server sends none', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('no json'); } });
    await expect(api('/books')).rejects.toThrow('Something went wrong');
  });
});
