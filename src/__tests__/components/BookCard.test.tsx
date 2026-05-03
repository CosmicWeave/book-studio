import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookCard from '@/components/BookCard';
import { AppContext } from '@/contexts/AppContext';
import type { Book } from '@/types';

// Minimal mock AppContext value
const mockAppContext: any = {
  isAiEnabled: false,
  restoreBook: vi.fn(),
  archiveBook: vi.fn(),
};

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    topic: 'My Test Book',
    subtitle: 'A subtitle',
    author: 'Jane Doe',
    description: 'Some description',
    instructions: '',
    wordCountGoal: 50000,
    generateImages: false,
    imageGenerationInstructions: '',
    status: 'writing',
    outline: [{ title: 'Chapter 1', summary: '' }],
    content: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as Book;
}

function renderCard(book: Book, props: Partial<React.ComponentProps<typeof BookCard>> = {}) {
  return render(
    <MemoryRouter>
      <AppContext.Provider value={mockAppContext}>
        <BookCard
          book={book}
          onDelete={vi.fn()}
          onManageSnapshots={vi.fn()}
          onGenerateCover={vi.fn()}
          onCreateRelated={vi.fn()}
          {...props}
        />
      </AppContext.Provider>
    </MemoryRouter>
  );
}

describe('BookCard component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the book title', () => {
    renderCard(makeBook({ topic: 'The Great Novel' }));
    expect(screen.getByText('The Great Novel')).toBeInTheDocument();
  });

  it('renders the book author', () => {
    renderCard(makeBook({ author: 'Arthur Dent' }));
    expect(screen.getByText('Arthur Dent')).toBeInTheDocument();
  });

  it('renders "Unknown Author" when author is absent', () => {
    renderCard(makeBook({ author: undefined }));
    expect(screen.getByText('Unknown Author')).toBeInTheDocument();
  });

  it('renders the book subtitle when provided', () => {
    renderCard(makeBook({ subtitle: 'Part One' }));
    expect(screen.getByText('Part One')).toBeInTheDocument();
  });

  it('displays chapter counts', () => {
    const book = makeBook({
      outline: [{ title: 'Ch1', summary: '' }, { title: 'Ch2', summary: '' }],
      content: [],
    });
    renderCard(book);
    expect(screen.getByText(/0 \/ 2 ch/)).toBeInTheDocument();
  });

  it('shows "Deleted" badge for soft-deleted books', () => {
    renderCard(makeBook({ deletedAt: Date.now() }));
    expect(screen.getByText('Deleted')).toBeInTheDocument();
  });

  it('shows "Archived" badge for archived books', () => {
    renderCard(makeBook({ status: 'archived' }));
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('shows "Complete" badge for completed books', () => {
    renderCard(makeBook({ status: 'complete' }));
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('opens the dropdown menu when the menu button is clicked', () => {
    renderCard(makeBook());
    const menuButton = screen.getByTitle ? undefined : screen.queryAllByRole('button')[0];
    // Find the more-vertical / three-dots button (it has no aria-label)
    const buttons = screen.getAllByRole('button');
    // The first (or one of the first) button is the menu trigger
    const menuBtn = buttons.find(b => b.querySelector('svg'));
    if (menuBtn) {
      fireEvent.click(menuBtn);
      // Menu items should appear after click
      expect(screen.getByText('Delete')).toBeInTheDocument();
    }
  });

  it('calls onDelete when Delete menu item is clicked', () => {
    const onDelete = vi.fn();
    renderCard(makeBook(), { onDelete });

    // Open the menu
    const buttons = screen.getAllByRole('button');
    const menuBtn = buttons[0]; // first button is the menu trigger
    fireEvent.click(menuBtn);

    // Click "Delete"
    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('shows "Restore Book" option for deleted books', () => {
    renderCard(makeBook({ deletedAt: Date.now() }));
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Restore Book')).toBeInTheDocument();
  });

  it('shows "Add to Series..." when onAddToSeries is provided', () => {
    renderCard(makeBook(), { onAddToSeries: vi.fn() });
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Add to Series...')).toBeInTheDocument();
  });

  it('does not show "Add to Series..." when not provided', () => {
    renderCard(makeBook());
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(screen.queryByText('Add to Series...')).not.toBeInTheDocument();
  });
});
