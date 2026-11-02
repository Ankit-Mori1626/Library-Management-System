import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Home from '../Home';
import { mockFetch, student, admin, loan, book, inDays } from './helpers';

afterEach(() => vi.restoreAllMocks());

describe('<Home /> for a student', () => {
  it('greets the student by first name', async () => {
    mockFetch();
    render(<Home user={student} go={() => {}} />);
    expect(await screen.findByText(/Hi Yash, here is what is on your shelf/)).toBeInTheDocument();
  });

  it('shows an empty state and a link to the catalogue when nothing is borrowed', async () => {
    mockFetch({ 'GET /loans': [], 'GET /reservations': [] });
    const go = vi.fn();
    render(<Home user={student} go={go} />);

    expect(await screen.findByText(/Nothing borrowed yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Find your next read'));
    expect(go).toHaveBeenCalledWith('catalog');
  });

  it('counts books on loan and those due within 3 days', async () => {
    mockFetch({
      'GET /loans': [
        loan({ _id: 'l1', dueAt: inDays(1.5) }), // due soon
        loan({ _id: 'l2', book: book({ _id: 'b2', title: 'Deep Work' }), dueAt: inDays(10) }),
        loan({ _id: 'l3', returnedAt: inDays(-1) }), // returned, not counted
      ],
    });
    render(<Home user={student} go={() => {}} />);

    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText('Due within 3 days').previousSibling).toHaveTextContent('1');
    expect(screen.getAllByText('Deep Work').length).toBeGreaterThan(0); // cover + title
  });

  it('adds up unpaid fines only', async () => {
    mockFetch({
      'GET /loans': [
        loan({ _id: 'l1', returnedAt: inDays(-2), fine: 10, finePaid: false }),
        loan({ _id: 'l2', returnedAt: inDays(-3), fine: 20, finePaid: true }), // already paid
        loan({ _id: 'l3', fine: 15 }), // running fine on an active loan
      ],
    });
    render(<Home user={student} go={() => {}} />);
    expect(await screen.findByText('₹25')).toBeInTheDocument();
  });

  it('counts reservations that are ready', async () => {
    mockFetch({ 'GET /reservations': [{ _id: 'r1', status: 'ready' }, { _id: 'r2', status: 'waiting' }] });
    render(<Home user={student} go={() => {}} />);
    const label = await screen.findByText('Reservations ready');
    await vi.waitFor(() => expect(label.previousSibling).toHaveTextContent('1'));
  });
});

describe('<Home /> for the librarian', () => {
  const stats = {
    titles: 12, students: 30, out: 7, overdue: 2,
    genres: [{ _id: 'Fiction', n: 6 }, { _id: 'Science', n: 3 }],
    top: [{ _id: 'b1', title: 'Clean Code', n: 9 }],
  };

  it('shows the dashboard numbers', async () => {
    mockFetch({ 'GET /stats': stats, 'GET /loans': [] });
    render(<Home user={admin} go={() => {}} />);

    const titles = await screen.findByText('Titles');
    await vi.waitFor(() => expect(titles.previousSibling).toHaveTextContent('12'));
    expect(screen.getByText('Students').previousSibling).toHaveTextContent('30');
    expect(screen.getByText('Books on loan').previousSibling).toHaveTextContent('7');
    expect(screen.getByText('Overdue').previousSibling).toHaveTextContent('2');
  });

  it('lists genres and the most borrowed books', async () => {
    mockFetch({ 'GET /stats': stats, 'GET /loans': [] });
    render(<Home user={admin} go={() => {}} />);

    expect(await screen.findByText('Fiction')).toBeInTheDocument();
    expect(screen.getByText('Science')).toBeInTheDocument();
    expect(screen.getByText('Clean Code')).toBeInTheDocument();
    expect(screen.getByText('9 loans')).toBeInTheDocument();
  });

  it('says so when no book is overdue', async () => {
    mockFetch({ 'GET /stats': stats, 'GET /loans': [loan({ dueAt: inDays(5) })] });
    render(<Home user={admin} go={() => {}} />);
    expect(await screen.findByText('No overdue books. Nice.')).toBeInTheDocument();
  });

  it('lists overdue books with the fine and a link to manage loans', async () => {
    mockFetch({ 'GET /stats': stats, 'GET /loans': [loan({ dueAt: inDays(-3), fine: 15 })] });
    const go = vi.fn();
    render(<Home user={admin} go={go} />);

    expect(await screen.findByText('₹15')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manage loans' }));
    expect(go).toHaveBeenCalledWith('loans');
  });
});
