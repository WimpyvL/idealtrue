import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import HostOnboardingTutorial from '@/pages/HostOnboardingTutorial';

describe('HostOnboardingTutorial', () => {
  it('explains the required host setup actions and links to the real setup screens', () => {
    render(
      <MemoryRouter>
        <HostOnboardingTutorial />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /get your hosting workspace ready/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add your banking details' })).toBeInTheDocument();
    expect(screen.getByText(/Accommodation payments are handled directly by you/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add payment instructions/i })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('heading', { name: 'Configure quick replies' })).toBeInTheDocument();
    expect(screen.getByText(/house rules, directions, payment info, check-in, and checkout/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /edit quick replies/i })).toHaveAttribute('href', '/host/quick-replies');
    expect(screen.getByText('Signed: (|/) Klaasvaakie')).toBeInTheDocument();
  });
});
