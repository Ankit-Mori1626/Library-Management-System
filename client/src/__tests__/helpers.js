import { vi } from 'vitest';

// Replaces the real fetch() so tests never need the backend.
// routes: { 'GET /loans': [...], 'POST /auth/login': {...}, 'PUT /loans/l1/return': { error: 'Not your loan' } }
// Anything not listed returns [].
export function mockFetch(routes = {}) {
  const calls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts = {}) => {
    const method = opts.method || 'GET';
    const path = String(url).replace('/api', '').split('?')[0];
    calls.push({ method, path, url: String(url), body: opts.body ? JSON.parse(opts.body) : undefined, headers: opts.headers });
    const hit = routes[`${method} ${path}`];
    if (hit && hit.error) return { ok: false, status: hit.status || 400, json: async () => ({ message: hit.error }) };
    return { ok: true, status: 200, json: async () => (hit === undefined ? [] : hit) };
  });
  return calls;
}

export const DAY = 864e5;
export const inDays = n => new Date(Date.now() + n * DAY).toISOString();

export const student = { name: 'Yash Palanpure', email: 'yash@test.com', role: 'student', studentId: 'S101', department: 'Information Technology' };
export const admin = { name: 'Librarian', email: 'admin@test.com', role: 'admin' };

export const book = (o = {}) => ({ _id: 'b1', title: 'Clean Code', author: 'Robert Martin', genre: 'Technology', year: 2008, shelf: 'C-01', isbn: '978-1', copies: 3, available: 2, description: 'Write readable code.', ...o });
export const loan = (o = {}) => ({ _id: 'l1', book: book(), user: { name: 'Yash Palanpure', studentId: 'S101' }, issuedAt: inDays(-5), dueAt: inDays(9), renewals: 0, fine: 0, finePaid: false, ...o });
