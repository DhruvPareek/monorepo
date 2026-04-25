import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/AltoVisualization', () => ({
  default: () => <div>alto visualization</div>,
}));

vi.mock('./components/BridgeVisualization', () => ({
  default: () => <div>bridge visualization</div>,
}));

vi.mock('./components/ChatVisualization', () => ({
  default: () => <div>chat visualization</div>,
}));

vi.mock('./components/FloodVisualization', () => ({
  default: () => <div>flood visualization</div>,
}));

vi.mock('./components/LogVisualization', () => ({
  default: () => <div>log visualization</div>,
}));

vi.mock('./components/MinimmitVisualization', () => ({
  default: () => <div>minimmit visualization</div>,
}));

vi.mock('./components/SyncVisualization', () => ({
  default: () => <div>sync visualization</div>,
}));

describe('App routing', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the visualization for the current pathname', () => {
    window.history.replaceState({}, '', '/bridge');

    render(<App />);

    screen.getByText('bridge visualization');
    expect(window.location.pathname).toBe('/bridge');
  });

  it('redirects the root path to /alto', async () => {
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/alto');
    });

    screen.getByText('alto visualization');
  });

  it('redirects unknown paths to /alto', async () => {
    window.history.replaceState({}, '', '/unknown');

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/alto');
    });

    screen.getByText('alto visualization');
  });

  it('updates the URL when switching tabs', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'minimmit' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/minimmit');
    });

    screen.getByText('minimmit visualization');
  });
});
