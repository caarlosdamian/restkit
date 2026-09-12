// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import CustomerHistory, { type HistoryEntry } from '@/components/dashboard/CustomerHistory';

/**
 * Recording a sale calls `router.refresh()`, which re-runs the server component
 * and hands this client component a fresh `initial` prop. It used to ignore it —
 * `useState(initial.entries)` reads its argument on the first render only — so
 * the stamp counter moved and "Historial de compras" kept showing the old list,
 * which read as "the sale didn't register".
 *
 * No testing-library in this repo, so this drives react-dom directly: render,
 * hand it new props the way a refresh does, and read the DOM back.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const entry = (id: string, tableName: string): HistoryEntry => ({
  _id: id,
  type: 'ACCRUAL',
  mechanic: 'sellos',
  delta: 1,
  orderTotal: 120,
  tableName,
  createdAt: new Date('2026-09-11T12:00:00Z').toISOString(),
  reversed: false,
});

/** A fresh object every time, exactly as an RSC payload deserialises. */
const payload = (entries: HistoryEntry[]) => ({
  entries,
  total: entries.length,
  hasMore: false,
});

function render(initial: ReturnType<typeof payload>) {
  act(() => {
    root.render(<CustomerHistory customerId="cust-1" initial={initial} />);
  });
}

describe('CustomerHistory re-syncing with the server', () => {
  it('shows the new movement when a refresh delivers one', () => {
    render(payload([entry('v1', 'Mesa 1')]));
    expect(container.textContent).toContain('Mesa 1');
    expect(container.textContent).toContain('1 movimiento');

    // What router.refresh() produces: same component, new props object.
    render(payload([entry('v2', 'Mesa 7'), entry('v1', 'Mesa 1')]));

    expect(container.textContent).toContain('Mesa 7');
    expect(container.textContent).toContain('Mesa 1');
    expect(container.textContent).toContain('2 movimientos');
  });

  it('goes from empty to populated, which is the first sale a customer ever gets', () => {
    render(payload([]));
    expect(container.textContent).toContain('Sin movimientos todavía');

    render(payload([entry('v1', 'Mesa 3')]));
    expect(container.textContent).not.toContain('Sin movimientos todavía');
    expect(container.textContent).toContain('Mesa 3');
  });

  it('does not reset on a re-render that carries the same props object', () => {
    // Referential equality is what keeps a client-only setState (paging,
    // removing) from being clobbered. Same object in, no re-sync.
    const stable = payload([entry('v1', 'Mesa 1')]);
    render(stable);
    render(stable);
    expect(container.textContent).toContain('Mesa 1');
    expect(container.textContent).toContain('1 movimiento');
  });
});
