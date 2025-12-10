//! General accessibility tests

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import App from '../App';
import { I18nProvider } from '../contexts/I18nContext';

expect.extend(toHaveNoViolations);

describe('App Accessibility', () => {
  it('should have no accessibility violations on main app', async () => {
    const { container } = render(
      <BrowserRouter>
        <I18nProvider>
          <App />
        </I18nProvider>
      </BrowserRouter>
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

