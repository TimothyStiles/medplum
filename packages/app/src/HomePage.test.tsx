import { Patient } from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/ui';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getDefaultFields, HomePage } from './HomePage';

let medplum: MockClient;

async function setup(url = '/Patient'): Promise<void> {
  medplum = new MockClient();
  await act(async () => {
    render(
      <MedplumProvider medplum={medplum}>
        <MemoryRouter initialEntries={[url]} initialIndex={0}>
          <Routes>
            <Route path="/:resourceType/new" element={<div>Create Resource Page</div>} />
            <Route path="/:resourceType/:id" element={<div>Resource Page</div>} />
            <Route path="/:resourceType" element={<HomePage />} />
            <Route path="/" element={<HomePage />} />
          </Routes>
        </MemoryRouter>
      </MedplumProvider>
    );
  });
}

describe('HomePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('Renders default page', async () => {
    await setup('/');
    await waitFor(() => screen.getByTestId('search-control'));

    const control = screen.getByTestId('search-control');
    expect(control).toBeDefined();
  });

  test('Renders with resourceType', async () => {
    await setup('/Patient');
    await waitFor(() => screen.getByTestId('search-control'));

    const control = screen.getByTestId('search-control');
    expect(control).toBeDefined();
  });

  test('Renders with resourceType and fields', async () => {
    await setup('/Patient?_fields=id,_lastUpdated,name,birthDate,gender');
    await waitFor(() => screen.getByTestId('search-control'));

    const control = screen.getByTestId('search-control');
    expect(control).toBeDefined();
  });

  test('Next page button', async () => {
    await setup();
    await waitFor(() => screen.getByTestId('next-page-button'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('next-page-button'));
    });
  });

  test('Prev page button', async () => {
    await setup();
    await waitFor(() => screen.getByTestId('prev-page-button'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('prev-page-button'));
    });
  });

  test('New button', async () => {
    await setup();
    await waitFor(() => screen.getByText('New...'));

    await act(async () => {
      fireEvent.click(screen.getByText('New...'));
    });
  });

  test('New button hidden on Bot page', async () => {
    await setup('/Bot');
    await waitFor(() => screen.getByTestId('search-control'));

    expect(screen.queryByText('New...')).toBeNull();
  });

  test('Delete button, cancel', async () => {
    window.confirm = jest.fn(() => false);

    await setup();
    await waitFor(() => screen.getByText('Delete...'));

    await act(async () => {
      fireEvent.click(screen.getByText('Delete...'));
    });
  });

  test('Delete button, ok', async () => {
    // Create a practitioner that we can delete
    const patient = await medplum.createResource<Patient>({
      resourceType: 'Patient',
    });

    window.confirm = jest.fn(() => true);

    await setup();
    await waitFor(() => screen.getByText('Delete...'));

    await act(async () => {
      fireEvent.click(screen.getByLabelText(`Checkbox for ${patient.id}`));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Delete...'));
    });

    const check = await medplum.readResource('Patient', patient.id as string);
    expect(check).toBeUndefined();
  });

  test('Export button', async () => {
    // window.confirm = jest.fn(() => false);
    window.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/blob');
    window.open = jest.fn();

    await setup();
    await waitFor(() => screen.getByText('Export...'));

    await act(async () => {
      fireEvent.click(screen.getByText('Export...'));
    });

    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(window.open).toHaveBeenCalled();
  });

  test('Default search fields', () => {
    expect(getDefaultFields('AccessPolicy')).toEqual(['id', '_lastUpdated', 'name']);
    expect(getDefaultFields('ClientApplication')).toEqual(['id', '_lastUpdated', 'name']);
    expect(getDefaultFields('CodeSystem')).toEqual(['id', '_lastUpdated', 'name', 'title', 'status']);
    expect(getDefaultFields('Condition')).toEqual(['id', '_lastUpdated', 'subject', 'code', 'clinicalStatus']);
    expect(getDefaultFields('Device')).toEqual(['id', '_lastUpdated', 'manufacturer', 'deviceName', 'patient']);
    expect(getDefaultFields('DeviceDefinition')).toEqual(['id', '_lastUpdated', 'manufacturer[x]', 'deviceName']);
    expect(getDefaultFields('DeviceRequest')).toEqual(['id', '_lastUpdated', 'code[x]', 'subject']);
    expect(getDefaultFields('DiagnosticReport')).toEqual(['id', '_lastUpdated', 'subject', 'code', 'status']);
    expect(getDefaultFields('Encounter')).toEqual(['id', '_lastUpdated', 'subject']);
    expect(getDefaultFields('Observation')).toEqual(['id', '_lastUpdated', 'subject', 'code', 'status']);
    expect(getDefaultFields('Organization')).toEqual(['id', '_lastUpdated', 'name']);
    expect(getDefaultFields('Patient')).toEqual(['id', '_lastUpdated', 'name', 'birthDate', 'gender']);
    expect(getDefaultFields('Practitioner')).toEqual(['id', '_lastUpdated', 'name']);
    expect(getDefaultFields('Project')).toEqual(['id', '_lastUpdated', 'name']);
    expect(getDefaultFields('Questionnaire')).toEqual(['id', '_lastUpdated', 'name']);
    expect(getDefaultFields('ServiceRequest')).toEqual([
      'id',
      '_lastUpdated',
      'subject',
      'code',
      'status',
      'orderDetail',
    ]);
    expect(getDefaultFields('Subscription')).toEqual(['id', '_lastUpdated', 'criteria']);
    expect(getDefaultFields('User')).toEqual(['id', '_lastUpdated', 'email']);
    expect(getDefaultFields('ValueSet')).toEqual(['id', '_lastUpdated', 'name', 'title', 'status']);
  });

  test('Left click on row', async () => {
    window.open = jest.fn();

    await setup('/Patient');
    await waitFor(() => screen.getByTestId('search-control'));

    await act(async () => {
      fireEvent.click(screen.getByText('Homer Simpson'));
    });

    // Change the tab
    expect(screen.getByText('Resource Page')).toBeInTheDocument();

    // Do not open a new browser tab
    expect(window.open).not.toHaveBeenCalled();
  });

  test('Middle click on row', async () => {
    window.open = jest.fn();

    await setup('/Patient');
    await waitFor(() => screen.getByTestId('search-control'));

    await act(async () => {
      fireEvent.click(screen.getByText('Homer Simpson'), { button: 1 });
    });

    // Should open a new browser tab
    expect(window.open).toHaveBeenCalledWith('/Patient/123', '_blank');

    // Should still be on the home page
    expect(screen.getByTestId('search-control')).toBeInTheDocument();
  });
});
