import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { mockFetch, student, admin } from './helpers';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockFetch({ 'GET /stats': { genres: [], top: [] } });
});
afterEach(() => vi.restoreAllMocks());

const loginAs = user => localStorage.setItem('user', JSON.stringify(user));

describe('<App />', () => {
  it('shows the login page when nobody is logged in', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('shows the student menu: Home, Catalogue, My books', () => {
    loginAs(student);
    render(<App />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveTextContent('Home');
    expect(nav).toHaveTextContent('Catalogue');
    expect(nav).toHaveTextContent('My books');
    expect(nav).not.toHaveTextContent('Students');
  });

  it('shows the student ID and department in the sidebar', () => {
    loginAs(student);
    render(<App />);
    expect(screen.getByText('Yash Palanpure')).toBeInTheDocument();
    expect(screen.getByText('S101 · Information Technology')).toBeInTheDocument();
  });

  it('shows the librarian menu: Dashboard, Catalogue, Loans, Students', () => {
    loginAs(admin);
    render(<App />);
    const nav = screen.getByRole('navigation');
    for (const t of ['Dashboard', 'Catalogue', 'Loans', 'Students']) expect(nav).toHaveTextContent(t);
    expect(screen.getByText('Librarian', { selector: 'span' })).toBeInTheDocument();
  });

  it('changes the page title when a menu button is clicked', () => {
    loginAs(student);
    render(<App />);
    expect(screen.getByRole('heading', { level: 2, name: 'Home' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'My books' }));
    expect(screen.getByRole('heading', { level: 2, name: 'My books' })).toBeInTheDocument();
  });

  it('log out clears the saved session and returns to the login page', () => {
    localStorage.setItem('token', 'abc');
    loginAs(student);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
