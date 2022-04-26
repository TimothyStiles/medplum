import { vi } from 'vitest';
import { killEvent } from './dom';

describe('DOM utils', () => {
  test('killEvent', () => {
    const e = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    killEvent(e as unknown as Event);
    expect(e.preventDefault).toBeCalled();
    expect(e.stopPropagation).toBeCalled();
  });
});
