import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Students from '../Students';
import { ToastCtx } from '../ui';
import { mockFetch } from './helpers';

afterEach(() => vi.restoreAllMocks());

const users = [
  { _id: 'u1', name: 'Alice Shah', email: 'alice@test.com', studentId: 'S1', department: 'IT', active: 2, owed: 0, blocked: false },
  { _id: 'u2', name: 'Bob Patel', email: 'bob@test.com', studentId: 'S2', department: 'Civil', active: 0, owed: 25, blocked: true },
];

describe('<Students />', () => {
  it('lists every student with books out and fines due', async () => {
    mockFetch({ 'GET /users': users });
    render(<Students />);

    expect(await screen.findByText('Alice Shah')).toBeInTheDocument();
    expect(screen.getByText('Bob Patel')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText('₹25')).toBeInTheDocument();
  });

  it('shows Block for active students and Unblock for blocked ones', async () => {
    mockFetch({ 'GET /users': users });
    render(<Students />);
    await screen.findByText('Alice Shah');
    expect(screen.getByRole('button', { name: 'Block' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unblock' })).toBeInTheDocument();
  });

  it('filters by name, student ID or email', async () => {
    mockFetch({ 'GET /users': users });
    render(<Students />);
    await screen.findByText('Alice Shah');

    fireEvent.change(screen.getByPlaceholderText(/Search by name/), { target: { value: 'bob@' } });
    expect(screen.queryByText('Alice Shah')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Patel')).toBeInTheDocument();
  });

  it('shows a message when nothing matches', async () => {
    mockFetch({ 'GET /users': users });
    render(<Students />);
    await screen.findByText('Alice Shah');

    fireEvent.change(screen.getByPlaceholderText(/Search by name/), { target: { value: 'zzzz' } });
    expect(screen.getByText('No students found.')).toBeInTheDocument();
  });

  it('blocking a student calls the API, shows a toast and reloads the list', async () => {
    const calls = mockFetch({ 'GET /users': users, 'PUT /users/u1/block': { blocked: true } });
    const toast = vi.fn();
    render(<ToastCtx.Provider value={toast}><Students /></ToastCtx.Provider>);
    await screen.findByText('Alice Shah');

    fireEvent.click(screen.getByRole('button', { name: 'Block' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Student blocked'));
    expect(calls.some(c => c.method === 'PUT' && c.path === '/users/u1/block')).toBe(true);
    expect(calls.filter(c => c.method === 'GET' && c.path === '/users')).toHaveLength(2); // loaded again
  });
});
