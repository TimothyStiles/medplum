import { getReferenceString } from '@medplum/core';
import { ExampleUserConfiguration, HomerServiceRequest, MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/ui';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResourcePage } from './ResourcePage';

const medplum = new MockClient();
medplum.getUserConfiguration = () => ExampleUserConfiguration;

describe('QuickStatus', () => {
  async function setup(url: string): Promise<void> {
    await act(async () => {
      render(
        <MedplumProvider medplum={medplum}>
          <MemoryRouter initialEntries={[url]} initialIndex={0}>
            <Routes>
              <Route path="/:resourceType/:id" element={<ResourcePage />} />
            </Routes>
          </MemoryRouter>
        </MedplumProvider>
      );
    });
  }

  test('Updates on change', async () => {
    await setup(`/${getReferenceString(HomerServiceRequest)}`);

    // Wait for the page to load
    await waitFor(() => screen.getByDisplayValue('ORDERED'));

    // Expect the status selector to be visible
    expect(screen.getByDisplayValue('ORDERED')).toBeInTheDocument();

    // Change the status
    await act(async () => {
      fireEvent.change(screen.getByDisplayValue('ORDERED'), {
        target: { value: 'SENT_TO_CUSTOMER' },
      });
    });
  });
});
