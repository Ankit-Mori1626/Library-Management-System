import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createRequire } from 'node:module';

// server.js is CommonJS, so load it (and the models) with require.
// This way the test and the server share the very same model objects and we can mock them.
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { app, fineFor } = require('../server');
const { User, Book, Loan, Reservation } = require('../models');

const DAY = 864e5;

// ---------- helpers ----------
let server, base;
beforeAll(async () => {
  await new Promise(resolve => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => server.close());
afterEach(() => vi.restoreAllMocks());

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

const studentToken = (id = 'u1') => jwt.sign({ id, role: 'student', name: 'Test Student' }, 'test-secret');
const adminToken = () => jwt.sign({ id: 'admin', role: 'admin', name: 'Librarian' }, 'test-secret');

// A fake mongoose document: has save() and toObject()
const doc = o => ({ save: vi.fn(function () { return Promise.resolve(this); }), toObject() { return { ...this }; }, ...o });
// Fake mongoose query: supports .populate().sort().select() and can be awaited
const chain = result => {
  const c = { populate: () => c, sort: () => c, select: () => c, then: (ok, fail) => Promise.resolve(result).then(ok, fail) };
  return c;
};

// =====================================================
describe('fineFor (fine calculation)', () => {
  it('is 0 when the book is not overdue', () => {
    expect(fineFor({ dueAt: Date.now() + DAY })).toBe(0);
  });

  it('charges Rs 5 for one day overdue', () => {
    expect(fineFor({ dueAt: Date.now() - 0.5 * DAY })).toBe(5);
  });

  it('rounds partial days up (2.5 days = 3 days = Rs 15)', () => {
    expect(fineFor({ dueAt: Date.now() - 2.5 * DAY })).toBe(15);
  });

  it('stops counting at the return date for returned books', () => {
    const due = new Date('2026-01-01').getTime();
    const l = { dueAt: due, returnedAt: due + 2 * DAY };
    expect(fineFor(l)).toBe(10); // returned 2 days late, even though today is much later
  });
});

// =====================================================
describe('Authentication guard', () => {
  it('rejects requests without a token (401)', async () => {
    const r = await call('GET', '/api/books');
    expect(r.status).toBe(401);
  });

  it('rejects an invalid token (401)', async () => {
    const r = await call('GET', '/api/books', { token: 'not-a-real-token' });
    expect(r.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret (401)', async () => {
    const fake = jwt.sign({ id: 'x', role: 'admin' }, 'wrong-secret');
    const r = await call('GET', '/api/books', { token: fake });
    expect(r.status).toBe(401);
  });

  it('blocks a student from librarian-only routes (403)', async () => {
    const r = await call('POST', '/api/books', { token: studentToken(), body: { title: 'x', author: 'y' } });
    expect(r.status).toBe(403);
  });
});

// =====================================================
describe('POST /api/auth/register', () => {
  const valid = { name: 'Yash', email: 'Yash@Test.com', password: 'secret123', studentId: 'S1', department: 'IT' };

  it('requires name, email, student ID and password', async () => {
    const r = await call('POST', '/api/auth/register', { body: { email: 'a@b.com' } });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/required/i);
  });

  it('rejects passwords shorter than 6 characters', async () => {
    const r = await call('POST', '/api/auth/register', { body: { ...valid, password: '123' } });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/at least 6/);
  });

  it('does not allow registering with the librarian email', async () => {
    const r = await call('POST', '/api/auth/register', { body: { ...valid, email: 'ADMIN@test.com' } });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/already registered/);
  });

  it('rejects an email that already exists', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue({ _id: 'x' });
    const r = await call('POST', '/api/auth/register', { body: valid });
    expect(r.status).toBe(400);
  });

  it('creates the student, hashes the password and returns a token', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    const create = vi.spyOn(User, 'create').mockImplementation(async d => ({ ...d, _id: 'id1', role: 'student' }));
    const r = await call('POST', '/api/auth/register', { body: valid });

    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user.role).toBe('student');
    const saved = create.mock.calls[0][0];
    expect(saved.password).not.toBe('secret123'); // never stored as plain text
    expect(saved.password.startsWith('$2')).toBe(true); // bcrypt hash
  });
});

// =====================================================
describe('POST /api/auth/login', () => {
  it('logs the librarian in with the .env credentials', async () => {
    const r = await call('POST', '/api/auth/login', { body: { email: 'Admin@Test.com', password: 'admin-pass' } });
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe('admin');
    expect(jwt.verify(r.body.token, 'test-secret').role).toBe('admin');
  });

  it('rejects a wrong librarian password', async () => {
    const r = await call('POST', '/api/auth/login', { body: { email: 'admin@test.com', password: 'nope' } });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Wrong email or password');
  });

  it('rejects an unknown student email', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    const r = await call('POST', '/api/auth/login', { body: { email: 'ghost@test.com', password: 'whatever' } });
    expect(r.status).toBe(400);
  });

  it('rejects a wrong student password', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue({ password: bcrypt.hashSync('right-pass', 4) });
    const r = await call('POST', '/api/auth/login', { body: { email: 's@test.com', password: 'wrong-pass' } });
    expect(r.status).toBe(400);
  });

  it('logs a student in with the right password', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue({ _id: 'u1', name: 'Yash', email: 's@test.com', role: 'student', password: bcrypt.hashSync('right-pass', 4) });
    const r = await call('POST', '/api/auth/login', { body: { email: 's@test.com', password: 'right-pass' } });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
  });

  it('gives a 1 day token without "remember" and a 30 day token with it', async () => {
    const days = async remember => {
      const r = await call('POST', '/api/auth/login', { body: { email: 'admin@test.com', password: 'admin-pass', remember } });
      const p = jwt.decode(r.body.token);
      return Math.round((p.exp - p.iat) / 86400);
    };
    expect(await days(false)).toBe(1);
    expect(await days(true)).toBe(30);
  });
});

// =====================================================
describe('Password reset', () => {
  const MSG = 'If that email is registered, we have sent a link to update your password.';

  it('forgot: gives the same reply when the email does not exist', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    const r = await call('POST', '/api/auth/forgot', { body: { email: 'ghost@test.com' } });
    expect(r.status).toBe(200);
    expect(r.body.message).toBe(MSG);
  });

  it('forgot: stores a hashed token that expires in about 10 minutes', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {}); // email is printed to console in tests
    const u = doc({ name: 'Yash', email: 's@test.com' });
    vi.spyOn(User, 'findOne').mockResolvedValue(u);
    const r = await call('POST', '/api/auth/forgot', { body: { email: 's@test.com' } });

    expect(r.body.message).toBe(MSG);
    expect(u.resetHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex, the raw token is not stored
    const minutes = (u.resetExpires - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(9);
    expect(minutes).toBeLessThanOrEqual(10);
    expect(u.save).toHaveBeenCalled();
  });

  it('reset: rejects a short password', async () => {
    const r = await call('POST', '/api/auth/reset', { body: { token: 'abc', password: '123' } });
    expect(r.status).toBe(400);
  });

  it('reset: rejects an invalid or expired token', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    const r = await call('POST', '/api/auth/reset', { body: { token: 'bad', password: 'newpass123' } });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/invalid or has expired/);
  });

  it('reset: saves the new password hashed and clears the token', async () => {
    const u = doc({ password: 'old', resetHash: 'h', resetExpires: new Date() });
    vi.spyOn(User, 'findOne').mockResolvedValue(u);
    const r = await call('POST', '/api/auth/reset', { body: { token: 'good', password: 'newpass123' } });

    expect(r.status).toBe(200);
    expect(bcrypt.compareSync('newpass123', u.password)).toBe(true);
    expect(u.resetHash).toBeUndefined();
    expect(u.resetExpires).toBeUndefined();
  });
});

// =====================================================
describe('Books', () => {
  it('search escapes regex characters (prevents regex injection)', async () => {
    const find = vi.spyOn(Book, 'find').mockReturnValue(chain([]));
    await call('GET', '/api/books?q=.*', { token: studentToken() });

    const filter = find.mock.calls[0][0];
    const re = filter.$or[0].title;
    expect(re.source).toBe('\\.\\*'); // the dot and star are escaped
    expect(re.test('Clean Code')).toBe(false); // so ".*" does NOT match everything
  });

  it('create: copies is at least 1 and available equals copies', async () => {
    const create = vi.spyOn(Book, 'create').mockImplementation(async d => d);
    const a = await call('POST', '/api/books', { token: adminToken(), body: { title: 'T', author: 'A', copies: 0 } });
    const b = await call('POST', '/api/books', { token: adminToken(), body: { title: 'T', author: 'A', copies: 5 } });
    expect(a.body.copies).toBe(1);
    expect(b.body.copies).toBe(5);
    expect(b.body.available).toBe(5);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('update: changing copies adjusts available copies', async () => {
    const b = doc({ copies: 3, available: 1 });
    vi.spyOn(Book, 'findById').mockResolvedValue(b);
    await call('PUT', '/api/books/b1', { token: adminToken(), body: { copies: 5 } });
    expect(b.copies).toBe(5);
    expect(b.available).toBe(3); // 1 + (5 - 3)
  });

  it('delete: refuses to delete a book that is on loan', async () => {
    vi.spyOn(Loan, 'exists').mockResolvedValue({ _id: 'l1' });
    const del = vi.spyOn(Book, 'findByIdAndDelete').mockResolvedValue(null);
    const r = await call('DELETE', '/api/books/b1', { token: adminToken() });
    expect(r.status).toBe(400);
    expect(del).not.toHaveBeenCalled();
  });

  it('delete: removes a book that is not on loan', async () => {
    vi.spyOn(Loan, 'exists').mockResolvedValue(null);
    const del = vi.spyOn(Book, 'findByIdAndDelete').mockResolvedValue(null);
    const r = await call('DELETE', '/api/books/b1', { token: adminToken() });
    expect(r.body.ok).toBe(true);
    expect(del).toHaveBeenCalledWith('b1');
  });
});

// =====================================================
describe('Borrowing a book (POST /api/loans)', () => {
  const borrow = () => call('POST', '/api/loans', { token: studentToken('u1'), body: { bookId: 'b1' } });
  const okUser = () => vi.spyOn(User, 'findById').mockResolvedValue({ blocked: false });
  const active = n => Array.from({ length: n }, (_, i) => ({ book: 'other' + i, dueAt: Date.now() + 5 * DAY }));

  it('rejects a blocked student', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ blocked: true });
    const r = await borrow();
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/blocked/);
  });

  it('rejects when the student is not found', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue(null);
    expect((await borrow()).body.message).toBe('Student not found');
  });

  it('enforces the 3 book limit', async () => {
    okUser(); vi.spyOn(Loan, 'find').mockResolvedValue(active(3));
    const r = await borrow();
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/Borrow limit reached/);
  });

  it('does not allow the same book twice', async () => {
    okUser(); vi.spyOn(Loan, 'find').mockResolvedValue([{ book: 'b1', dueAt: Date.now() + 5 * DAY }]);
    expect((await borrow()).body.message).toBe('You already have this book');
  });

  it('blocks students who have an overdue book', async () => {
    okUser(); vi.spyOn(Loan, 'find').mockResolvedValue([{ book: 'x', dueAt: Date.now() - DAY }]);
    expect((await borrow()).body.message).toMatch(/overdue books and unpaid fines/);
  });

  it('blocks students who have an unpaid fine', async () => {
    okUser(); vi.spyOn(Loan, 'find').mockResolvedValue([{ book: 'x', returnedAt: new Date(), fine: 10, finePaid: false }]);
    expect((await borrow()).body.message).toMatch(/overdue books and unpaid fines/);
  });

  it('rejects an unknown book', async () => {
    okUser(); vi.spyOn(Loan, 'find').mockResolvedValue([]);
    vi.spyOn(Book, 'findById').mockResolvedValue(null);
    expect((await borrow()).body.message).toBe('Book not found');
  });

  it('suggests reserving when no copies are available', async () => {
    okUser(); vi.spyOn(Loan, 'find').mockResolvedValue([]);
    vi.spyOn(Book, 'findById').mockResolvedValue(doc({ available: 0 }));
    vi.spyOn(Reservation, 'findOne').mockResolvedValue(null);
    expect((await borrow()).body.message).toMatch(/No copies available/);
  });

  it('lends the book: one copy less, due in 14 days', async () => {
    okUser(); vi.spyOn(Loan, 'find').mockResolvedValue([]);
    const b = doc({ available: 2 });
    vi.spyOn(Book, 'findById').mockResolvedValue(b);
    vi.spyOn(Reservation, 'findOne').mockResolvedValue(null);
    const create = vi.spyOn(Loan, 'create').mockImplementation(async d => d);

    const r = await borrow();
    expect(r.status).toBe(200);
    expect(b.available).toBe(1);
    const days = (create.mock.calls[0][0].dueAt - Date.now()) / DAY;
    expect(days).toBeGreaterThan(13.99);
    expect(days).toBeLessThanOrEqual(14);
  });

  it('uses the held copy (does not reduce stock) when the student has a ready reservation', async () => {
    okUser(); vi.spyOn(Loan, 'find').mockResolvedValue([]);
    const b = doc({ available: 0 });
    const held = doc({ status: 'ready' });
    vi.spyOn(Book, 'findById').mockResolvedValue(b);
    vi.spyOn(Reservation, 'findOne').mockResolvedValue(held);
    vi.spyOn(Loan, 'create').mockImplementation(async d => d);

    const r = await borrow();
    expect(r.status).toBe(200);
    expect(held.status).toBe('done');
    expect(b.available).toBe(0);
  });

  it('librarian must choose a student', async () => {
    const r = await call('POST', '/api/loans', { token: adminToken(), body: { bookId: 'b1' } });
    expect(r.body.message).toBe('Choose a student');
  });
});

// =====================================================
describe('Returning a book (PUT /api/loans/:id/return)', () => {
  it('rejects a loan that belongs to someone else', async () => {
    vi.spyOn(Loan, 'findById').mockResolvedValue(doc({ user: 'someone-else', book: 'b1' }));
    const r = await call('PUT', '/api/loans/l1/return', { token: studentToken('u1') });
    expect(r.body.message).toBe('This is not your loan');
  });

  it('rejects a loan that is already returned', async () => {
    vi.spyOn(Loan, 'findById').mockResolvedValue(doc({ user: 'u1', returnedAt: new Date() }));
    const r = await call('PUT', '/api/loans/l1/return', { token: studentToken('u1') });
    expect(r.body.message).toBe('Loan not found');
  });

  it('calculates the fine and puts the copy back on the shelf', async () => {
    const l = doc({ user: 'u1', book: 'b1', dueAt: new Date(Date.now() - 1.5 * DAY) });
    vi.spyOn(Loan, 'findById').mockResolvedValue(l);
    vi.spyOn(Reservation, 'findOne').mockReturnValue(chain(null)); // nobody waiting
    const inc = vi.spyOn(Book, 'findByIdAndUpdate').mockResolvedValue(null);

    const r = await call('PUT', '/api/loans/l1/return', { token: studentToken('u1') });
    expect(r.status).toBe(200);
    expect(l.fine).toBe(10); // 2 days late x Rs 5
    expect(l.returnedAt).toBeInstanceOf(Date);
    expect(inc).toHaveBeenCalledWith('b1', { $inc: { available: 1 } });
  });

  it('holds the copy for the first student in the reservation queue', async () => {
    const l = doc({ user: 'u1', book: 'b1', dueAt: new Date(Date.now() + DAY) });
    const waiting = doc({ status: 'waiting' });
    vi.spyOn(Loan, 'findById').mockResolvedValue(l);
    vi.spyOn(Reservation, 'findOne').mockReturnValue(chain(waiting));
    const inc = vi.spyOn(Book, 'findByIdAndUpdate').mockResolvedValue(null);

    await call('PUT', '/api/loans/l1/return', { token: studentToken('u1') });
    expect(waiting.status).toBe('ready');
    expect(inc).not.toHaveBeenCalled(); // stock stays the same, the copy is held
  });
});

// =====================================================
describe('Renewing a book (PUT /api/loans/:id/renew)', () => {
  const renew = () => call('PUT', '/api/loans/l1/renew', { token: studentToken('u1') });

  it('allows only one renewal', async () => {
    vi.spyOn(Loan, 'findById').mockResolvedValue(doc({ user: 'u1', renewals: 1, dueAt: new Date(Date.now() + DAY) }));
    expect((await renew()).body.message).toBe('Each book can be renewed once');
  });

  it('does not renew overdue books', async () => {
    vi.spyOn(Loan, 'findById').mockResolvedValue(doc({ user: 'u1', renewals: 0, dueAt: new Date(Date.now() - DAY) }));
    expect((await renew()).body.message).toMatch(/Overdue books cannot be renewed/);
  });

  it('does not renew when another student is waiting', async () => {
    vi.spyOn(Loan, 'findById').mockResolvedValue(doc({ user: 'u1', book: 'b1', renewals: 0, dueAt: new Date(Date.now() + DAY) }));
    vi.spyOn(Reservation, 'exists').mockResolvedValue({ _id: 'r1' });
    expect((await renew()).body.message).toMatch(/Another student is waiting/);
  });

  it('adds 7 days to the due date', async () => {
    const due = new Date(Date.now() + 2 * DAY);
    const l = doc({ user: 'u1', book: 'b1', renewals: 0, dueAt: due });
    vi.spyOn(Loan, 'findById').mockResolvedValue(l);
    vi.spyOn(Reservation, 'exists').mockResolvedValue(null);

    const r = await renew();
    expect(r.status).toBe(200);
    expect(l.dueAt.getTime()).toBe(due.getTime() + 7 * DAY);
    expect(l.renewals).toBe(1);
  });
});

// =====================================================
describe('Paying a fine (PUT /api/loans/:id/payfine)', () => {
  it('is librarian only', async () => {
    const r = await call('PUT', '/api/loans/l1/payfine', { token: studentToken() });
    expect(r.status).toBe(403);
  });

  it('needs the book to be returned first', async () => {
    vi.spyOn(Loan, 'findById').mockResolvedValue(doc({ returnedAt: undefined }));
    const r = await call('PUT', '/api/loans/l1/payfine', { token: adminToken() });
    expect(r.body.message).toMatch(/Return the book/);
  });

  it('marks the fine as paid', async () => {
    const l = doc({ returnedAt: new Date(), fine: 10 });
    vi.spyOn(Loan, 'findById').mockResolvedValue(l);
    await call('PUT', '/api/loans/l1/payfine', { token: adminToken() });
    expect(l.finePaid).toBe(true);
  });
});

// =====================================================
describe('Reservations', () => {
  const reserve = () => call('POST', '/api/reservations', { token: studentToken('u1'), body: { bookId: 'b1' } });

  it('rejects an unknown book', async () => {
    vi.spyOn(Book, 'findById').mockResolvedValue(null);
    expect((await reserve()).body.message).toBe('Book not found');
  });

  it('asks the student to borrow when copies are available', async () => {
    vi.spyOn(Book, 'findById').mockResolvedValue({ _id: 'b1', available: 2 });
    expect((await reserve()).body.message).toMatch(/Borrow it instead/);
  });

  it('does not allow a duplicate reservation', async () => {
    vi.spyOn(Book, 'findById').mockResolvedValue({ _id: 'b1', available: 0 });
    vi.spyOn(Reservation, 'exists').mockResolvedValue({ _id: 'r1' });
    expect((await reserve()).body.message).toBe('You already reserved this book');
  });

  it('does not allow reserving a book the student already has', async () => {
    vi.spyOn(Book, 'findById').mockResolvedValue({ _id: 'b1', available: 0 });
    vi.spyOn(Reservation, 'exists').mockResolvedValue(null);
    vi.spyOn(Loan, 'exists').mockResolvedValue({ _id: 'l1' });
    expect((await reserve()).body.message).toBe('You already have this book');
  });

  it('creates a reservation when all copies are out', async () => {
    vi.spyOn(Book, 'findById').mockResolvedValue({ _id: 'b1', available: 0 });
    vi.spyOn(Reservation, 'exists').mockResolvedValue(null);
    vi.spyOn(Loan, 'exists').mockResolvedValue(null);
    const create = vi.spyOn(Reservation, 'create').mockImplementation(async d => d);
    const r = await reserve();
    expect(r.status).toBe(200);
    expect(create).toHaveBeenCalledWith({ book: 'b1', user: 'u1' });
  });

  it('cancelling a ready reservation releases the copy', async () => {
    const res = doc({ status: 'ready', user: 'u1', book: 'b1' });
    vi.spyOn(Reservation, 'findById').mockResolvedValue(res);
    vi.spyOn(Reservation, 'findOne').mockReturnValue(chain(null));
    const inc = vi.spyOn(Book, 'findByIdAndUpdate').mockResolvedValue(null);

    const r = await call('DELETE', '/api/reservations/r1', { token: studentToken('u1') });
    expect(r.body.ok).toBe(true);
    expect(res.status).toBe('cancelled');
    expect(inc).toHaveBeenCalledWith('b1', { $inc: { available: 1 } });
  });

  it('a student cannot cancel someone else’s reservation', async () => {
    vi.spyOn(Reservation, 'findById').mockResolvedValue(doc({ status: 'waiting', user: 'other' }));
    const r = await call('DELETE', '/api/reservations/r1', { token: studentToken('u1') });
    expect(r.body.message).toBe('This is not your reservation');
  });
});

// =====================================================
describe('Librarian: students and stats', () => {
  it('block toggles the blocked flag', async () => {
    const u = doc({ blocked: false });
    vi.spyOn(User, 'findById').mockResolvedValue(u);
    const r = await call('PUT', '/api/users/u1/block', { token: adminToken() });
    expect(r.body.blocked).toBe(true);
    expect(u.save).toHaveBeenCalled();
  });

  it('block is not available to students', async () => {
    const r = await call('PUT', '/api/users/u1/block', { token: studentToken() });
    expect(r.status).toBe(403);
  });

  it('stats returns the dashboard numbers', async () => {
    vi.spyOn(Book, 'countDocuments').mockResolvedValue(12);
    vi.spyOn(User, 'countDocuments').mockResolvedValue(30);
    vi.spyOn(Loan, 'countDocuments').mockResolvedValueOnce(7).mockResolvedValueOnce(2);
    vi.spyOn(Book, 'aggregate').mockResolvedValue([{ _id: 'Fiction', n: 5 }]);
    vi.spyOn(Loan, 'aggregate').mockResolvedValue([]);

    const r = await call('GET', '/api/stats', { token: adminToken() });
    expect(r.body).toMatchObject({ titles: 12, students: 30, out: 7, overdue: 2 });
  });
});
