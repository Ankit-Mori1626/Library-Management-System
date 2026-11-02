import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Cover, Modal, PasswordInput } from '../ui';

describe('<Cover />', () => {
  it('shows the book title and author', () => {
    render(<Cover b={{ title: 'Sapiens', author: 'Yuval Noah Harari' }} />);
    expect(screen.getByText('Sapiens')).toBeInTheDocument();
    expect(screen.getByText('Yuval Noah Harari')).toBeInTheDocument();
  });

  it('adds the "mini" class in compact mode', () => {
    const { container } = render(<Cover b={{ title: 'A', author: 'B' }} mini />);
    expect(container.firstChild).toHaveClass('cover', 'mini');
  });
});

describe('<Modal />', () => {
  it('renders a dialog with the title and content', () => {
    render(<Modal title="Issue a book" onClose={() => {}}><p>Inside the modal</p></Modal>);
    expect(screen.getByRole('dialog', { name: 'Issue a book' })).toBeInTheDocument();
    expect(screen.getByText('Inside the modal')).toBeInTheDocument();
  });

  it('closes with the × button', () => {
    const onClose = vi.fn();
    render(<Modal title="T" onClose={onClose}>x</Modal>);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<Modal title="T" onClose={onClose}>x</Modal>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const onClose = vi.fn();
    render(<Modal title="T" onClose={onClose}>x</Modal>);
    fireEvent.keyDown(window, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the dark background is clicked, but not when the dialog itself is clicked', () => {
    const onClose = vi.fn();
    render(<Modal title="T" onClose={onClose}>x</Modal>);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('<PasswordInput />', () => {
  it('hides the password by default', () => {
    render(<PasswordInput placeholder="Password" />);
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('type', 'password');
  });

  it('shows and hides the password with the eye button', () => {
    render(<PasswordInput placeholder="Password" />);
    const input = screen.getByPlaceholderText('Password');

    fireEvent.click(screen.getByLabelText('Show password'));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByLabelText('Hide password'));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('passes normal input props through (value, name)', () => {
    render(<PasswordInput name="password" defaultValue="secret" placeholder="Password" />);
    const input = screen.getByPlaceholderText('Password');
    expect(input).toHaveValue('secret');
    expect(input).toHaveAttribute('name', 'password');
  });
});
