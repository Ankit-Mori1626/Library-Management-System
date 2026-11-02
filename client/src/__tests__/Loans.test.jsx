import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Loans from '../Loans';
import { ToastCtx } from '../ui';
import { mockFetch, student, admin, loan, book, inDays } from './helpers';

afterEach(() => vi.restoreAllMocks());

const renderLoans = (user, routes) => {
  const calls = mockFetch(routes);
  const toast = vi.fn();
  render(<ToastCtx.Provider value={toast}><Loans user={user} /></ToastCtx.Provider>);
  return { calls, toast };
};

describe('<Loans /> as a student', () => {
  it('shows an empty message when there are no loans', async () => {
    renderLoans(student, { 'GET /loans': [] });
    expect(await screen.findByText(/You have no books on loan/)).toBeInTheDocument();
  });

  it('shows only active loans on the first tab', async () => {
    renderLoans(student, { 'GET /loans': [
      loan({ _id: 'l1' }),
      loan({ _id: 'l2', book: book({ title: 'Old Book' }), returnedAt: inDays(-3) }),
    ] });
    expect((await screen.findAllByText('Clean Code')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Old Book')).toHaveLength(0);
  });

  it('shows a red overdue badge', async () => {
    renderLoans(student, { 'GET /loans': [loan({ dueAt: inDays(-1.5), fine: 10 })] });
    expect(await screen.findByText('Overdue by 2 days')).toBeInTheDocument();
    expect(screen.getByText('₹10 fine')).toBeInTheDocument();
  });

  it('returns a book', async () => {
    const { calls, toast } = renderLoans(student, { 'GET /loans': [loan()], 'PUT /loans/l1/return': { _id: 'l1' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Return' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Book returned'));
    expect(calls.some(c => c.method === 'PUT' && c.path === '/loans/l1/return')).toBe(true);
  });

  it('renews a book', async () => {
    const { calls, toast } = renderLoans(student, { 'GET /loans': [loan()], 'PUT /loans/l1/renew': { _id: 'l1' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Renew' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Renewed for 7 more days'));
    expect(calls.some(c => c.path === '/loans/l1/renew')).toBe(true);
  });

  it('shows the server message as an error toast when renewing is refused', async () => {
    const { toast } = renderLoans(student, { 'GET /loans': [loan()], 'PUT /loans/l1/renew': { error: 'Each book can be renewed once' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Renew' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Each book can be renewed once', 1));
  });

  it('does not show the "Issue a book" button', async () => {
    renderLoans(student, { 'GET /loans': [] });
    await screen.findByText(/You have no books on loan/);
    expect(screen.queryByRole('button', { name: 'Issue a book' })).not.toBeInTheDocument();
  });

  it('history tab shows returned books without Return/Renew buttons', async () => {
    renderLoans(student, { 'GET /loans': [loan({ returnedAt: inDays(-2) })] });
    fireEvent.click(await screen.findByRole('button', { name: 'History' }));
    expect((await screen.findAllByText('Clean Code')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Return' })).not.toBeInTheDocument();
  });

  it('reservations tab shows the queue position and can cancel', async () => {
    const { calls, toast } = renderLoans(student, {
      'GET /loans': [],
      'GET /reservations': [{ _id: 'r1', book: book({ title: 'Sapiens' }), status: 'waiting', position: 1, createdAt: inDays(-1) }],
      'DELETE /reservations/r1': { ok: true },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Reservations' }));
    expect(await screen.findByText('Waiting · #1 in queue')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Reservation cancelled'));
    expect(calls.some(c => c.method === 'DELETE' && c.path === '/reservations/r1')).toBe(true);
  });

  it('reservations tab says when a copy is ready', async () => {
    renderLoans(student, { 'GET /loans': [], 'GET /reservations': [{ _id: 'r1', book: book(), status: 'ready', createdAt: inDays(-1) }] });
    fireEvent.click(await screen.findByRole('button', { name: 'Reservations' }));
    expect(await screen.findByText('Ready. Borrow it now')).toBeInTheDocument();
  });
});

describe('<Loans /> as the librarian', () => {
  const loans = [
    loan({ _id: 'l1', dueAt: inDays(5) }),
    loan({ _id: 'l2', book: book({ title: 'Late Book' }), dueAt: inDays(-4), user: { name: 'Bob Patel', studentId: 'S2' } }),
    loan({ _id: 'l3', book: book({ title: 'Fine Book' }), returnedAt: inDays(-2), fine: 20, finePaid: false }),
  ];

  it('has all five tabs', async () => {
    renderLoans(admin, { 'GET /loans': loans });
    await screen.findAllByText('Clean Code');
    for (const t of ['Active', 'Overdue', 'Unpaid fines', 'History', 'Reservations']) expect(screen.getByRole('button', { name: t })).toBeInTheDocument();
  });

  it('shows who borrowed each book', async () => {
    renderLoans(admin, { 'GET /loans': loans });
    expect(await screen.findByText(/Bob Patel \(S2\)/)).toBeInTheDocument();
  });

  it('overdue tab shows only overdue books', async () => {
    renderLoans(admin, { 'GET /loans': loans });
    fireEvent.click(await screen.findByRole('button', { name: 'Overdue' }));
    expect((await screen.findAllByText('Late Book')).length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Clean Code')).toHaveLength(0);
  });

  it('unpaid fines tab lets the librarian mark a fine as paid', async () => {
    const { calls, toast } = renderLoans(admin, { 'GET /loans': loans, 'PUT /loans/l3/payfine': { _id: 'l3' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Unpaid fines' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark paid' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Fine marked as paid'));
    expect(calls.some(c => c.method === 'PUT' && c.path === '/loans/l3/payfine')).toBe(true);
  });

  it('issues a book to a student', async () => {
    const students = [{ _id: 'u1', name: 'Alice Shah', studentId: 'S1', blocked: false }, { _id: 'u2', name: 'Blocked Bob', studentId: 'S2', blocked: true }];
    const { calls, toast } = renderLoans(admin, {
      'GET /loans': [], 'GET /users': students,
      'GET /books': [book({ _id: 'b1', available: 2 }), book({ _id: 'b9', title: 'Gone', available: 0 })],
      'POST /loans': { _id: 'l9' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Issue a book' }));
    const dialog = await screen.findByRole('dialog', { name: 'Issue a book' });

    // blocked students and books with no copies are not offered
    await screen.findByText('Alice Shah (S1)');
    expect(screen.queryByText(/Blocked Bob/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gone/)).not.toBeInTheDocument();

    const [studentSelect, bookSelect] = dialog.querySelectorAll('select');
    fireEvent.change(studentSelect, { target: { value: 'u1' } });
    fireEvent.change(bookSelect, { target: { value: 'b1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue book' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Book issued for 14 days'));
    expect(calls.find(c => c.method === 'POST' && c.path === '/loans').body).toEqual({ userId: 'u1', bookId: 'b1' });
  });
});
