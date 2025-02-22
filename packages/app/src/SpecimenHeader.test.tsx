import { Specimen } from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/ui';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SpecimenHeader } from './SpecimenHeader';

const medplum = new MockClient();

describe('SpecimenHeader', () => {
  function setup(specimen: Specimen): void {
    render(
      <MemoryRouter>
        <MedplumProvider medplum={medplum}>
          <SpecimenHeader specimen={specimen} />
        </MedplumProvider>
      </MemoryRouter>
    );
  }

  test('Renders no collection', async () => {
    setup({
      resourceType: 'Specimen',
    });

    expect(screen.getByText('Specimen')).toBeInTheDocument();
  });

  test('Renders collection no collectedDateTime', async () => {
    setup({
      resourceType: 'Specimen',
      collection: {},
    });

    expect(screen.getByText('Specimen')).toBeInTheDocument();
  });

  test('Renders collection and collectedDateTime', async () => {
    const birthDate = new Date();
    birthDate.setUTCHours(0, 0, 0, 0);
    birthDate.setUTCDate(birthDate.getUTCDate() - 5);

    setup({
      resourceType: 'Specimen',
      collection: {
        collectedDateTime: birthDate.toISOString(),
      },
    });

    expect(screen.getByText('005D')).toBeInTheDocument();
  });
});
