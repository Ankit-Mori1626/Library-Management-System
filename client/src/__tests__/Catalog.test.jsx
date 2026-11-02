import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Catalog from '../Catalog';
import { ToastCtx } from '../ui';
import { mockFetch, student, admin, book } from './helpers';

afterEach(() => vi.restoreAllMocks());

const books = [
  book({ _id: 'b1', title: 'Clean Code', genre: 'Technology', available: 2, copies: 3 }),
  book({ _id: 'b2', title: 'Sapiens', genre: 'History', available: 0, copies: 2 }),
];

const renderCatalog = (user, routes) => {
  const calls = mockFetch({ 'GET /books': books, ...routes });
  const toast = vi.fn();
  render(<ToastCtx.Provider value={toast}><Catalog user={user} /></ToastCtx.Provider>);
  return { calls, toast };
};
const open = async title => fireEvent.click(await screen.findByText(title));

describe('<Catalog /> browsing', () => {
  it('shows every book with its availability', async () => {
    renderCatalog(student);
    expect(await screen.findByText('Clean Code')).toBeInTheDocument();
    expect(screen.getByText('Sapiens')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 available')).toBeInTheDocument();
    expect(screen.getByText('All copies out')).toBeInTheDocument();
  });

  it('creates a genre filter button for each genre', async () => {
    renderCatalog(student);
    await screen.findByText('Clean Code');
    for (const g of ['All', 'Technology', 'History']) expect(screen.getByRole('button', { name: g })).toBeInTheDocument();
  });

  it('filters books when a genre is clicked', async () => {
    renderCatalog(student);
    await screen.findByText('Clean Code');
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.queryByText('Clean Code')).not.toBeInTheDocument();
    expect(screen.getByText('Sapiens')).toBeInTheDocument();
  });

  it('searches the API with what the student types', async () => {
    const { calls } = renderCatalog(student);
    await screen.findByText('Clean Code');
    fireEvent.change(screen.getByPlaceholderText(/Search by title/), { target: { value: 'sap & co' } });
    await waitFor(() => expect(calls.some(c => c.url === '/api/books?q=sap%20%26%20co')).toBe(true));
  });

  it('shows a friendly message when there are no results', async () => {
    renderCatalog(student, { 'GET /books': [] });
    expect(await screen.findByText(/No books match that search/)).toBeInTheDocument();
  });
});

describe('<Catalog /> as a student', () => {
  it('opens the book details', async () => {
    renderCatalog(student);
    await open('Clean Code');
    const dialog = await screen.findByRole('dialog', { name: 'Clean Code' });
    expect(dialog).toHaveTextContent('Write readable code.');
    expect(dialog).toHaveTextContent('C-01');
  });

  it('can borrow a book that has copies available', async () => {
    const { calls, toast } = renderCatalog(student, { 'POST /loans': { _id: 'l1' } });
    await open('Clean Code');
    fireEvent.click(await screen.findByRole('button', { name: 'Borrow this book' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Borrowed. Due in 14 days'));
    const post = calls.find(c => c.method === 'POST' && c.path === '/loans');
    expect(post.body).toEqual({ bookId: 'b1' });
  });

  it('can reserve a book when all copies are out', async () => {
    const { calls, toast } = renderCatalog(student, { 'POST /reservations': { _id: 'r1' } });
    await open('Sapiens');
    fireEvent.click(await screen.findByRole('button', { name: 'Reserve this book' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Reserved. We will hold a copy for you'));
    expect(calls.find(c => c.method === 'POST' && c.path === '/reservations').body).toEqual({ bookId: 'b2' });
  });

  it('shows the queue position (disabled button) when already reserved', async () => {
    renderCatalog(student, { 'GET /reservations': [{ _id: 'r1', book: { _id: 'b2' }, status: 'waiting', position: 2 }] });
    await open('Sapiens');
    const btn = await screen.findByRole('button', { name: /you are #2 in the queue/ });
    expect(btn).toBeDisabled();
  });

  it('offers to borrow the held copy when the reservation is ready', async () => {
    renderCatalog(student, { 'GET /reservations': [{ _id: 'r1', book: { _id: 'b2' }, status: 'ready' }] });
    await open('Sapiens');
    expect(await screen.findByRole('button', { name: 'Borrow your reserved copy' })).toBeInTheDocument();
  });

  it('shows the server error as a red toast when borrowing fails', async () => {
    const { toast } = renderCatalog(student, { 'POST /loans': { error: 'Borrow limit reached (3 books). Return one first' } });
    await open('Clean Code');
    fireEvent.click(await screen.findByRole('button', { name: 'Borrow this book' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Borrow limit reached (3 books). Return one first', 1));
  });

  it('does not show librarian buttons', async () => {
    renderCatalog(student);
    await screen.findByText('Clean Code');
    expect(screen.queryByRole('button', { name: 'Add a book' })).not.toBeInTheDocument();
  });
});

describe('<Catalog /> as the librarian', () => {
  it('can open the "Add a book" form and add a book', async () => {
    const { calls, toast } = renderCatalog(admin, { 'POST /books': { _id: 'new' } });
    await screen.findByText('Clean Code');

    fireEvent.click(screen.getByRole('button', { name: 'Add a book' }));
    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Refactoring' } });
    fireEvent.change(screen.getByPlaceholderText('Author'), { target: { value: 'Martin Fowler' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add book' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Book added'));
    const post = calls.find(c => c.method === 'POST' && c.path === '/books');
    expect(post.body).toMatchObject({ title: 'Refactoring', author: 'Martin Fowler' });
  });

  it('sees Edit and Delete instead of Borrow', async () => {
    renderCatalog(admin);
    await open('Clean Code');
    expect(await screen.findByRole('button', { name: 'Edit book' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Borrow this book' })).not.toBeInTheDocument();
  });

  it('edits a book with PUT', async () => {
    const { calls, toast } = renderCatalog(admin, { 'PUT /books/b1': { _id: 'b1' } });
    await open('Clean Code');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit book' }));
    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Clean Code 2nd Ed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Book updated'));
    expect(calls.find(c => c.method === 'PUT').body.title).toBe('Clean Code 2nd Ed');
  });

  it('deletes a book after confirmation', async () => {
    globalThis.confirm = vi.fn(() => true);
    const { calls, toast } = renderCatalog(admin, { 'DELETE /books/b1': { ok: true } });
    await open('Clean Code');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Book deleted'));
    expect(calls.some(c => c.method === 'DELETE' && c.path === '/books/b1')).toBe(true);
  });

  it('does not delete when the librarian cancels the confirmation', async () => {
    globalThis.confirm = vi.fn(() => false);
    const { calls } = renderCatalog(admin);
    await open('Clean Code');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(calls.some(c => c.method === 'DELETE')).toBe(false);
  });
});
