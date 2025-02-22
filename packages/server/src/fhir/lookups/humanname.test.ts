import { assertOk, Operator } from '@medplum/core';
import { Patient } from '@medplum/fhirtypes';
import { randomUUID } from 'crypto';
import { loadTestConfig } from '../../config';
import { closeDatabase, initDatabase } from '../../database';
import { bundleContains } from '../../test.setup';
import { seedDatabase } from '../../seed';
import { systemRepo } from '../repo';

describe('HumanName Lookup Table', () => {
  beforeAll(async () => {
    const config = await loadTestConfig();
    await initDatabase(config.database);
    await seedDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test('HumanName', async () => {
    const name = randomUUID();

    const [createOutcome, patient] = await systemRepo.createResource<Patient>({
      resourceType: 'Patient',
      name: [{ given: ['Alice'], family: name }],
    });
    assertOk(createOutcome, patient);

    const [searchOutcome, searchResult] = await systemRepo.search({
      resourceType: 'Patient',
      filters: [
        {
          code: 'name',
          operator: Operator.EQUALS,
          value: name,
        },
      ],
    });
    assertOk(searchOutcome, searchResult);
    expect(searchResult.entry?.length).toEqual(1);
    expect(searchResult.entry?.[0]?.resource?.id).toEqual(patient?.id);
  });

  test('Search with spaces', async () => {
    const name1 = randomUUID();
    const name2 = randomUUID();
    const name3 = randomUUID();

    const [createOutcome, patient] = await systemRepo.createResource<Patient>({
      resourceType: 'Patient',
      name: [{ given: [name1, name2], family: name3 }],
    });
    assertOk(createOutcome, patient);

    const [searchOutcome, searchResult] = await systemRepo.search({
      resourceType: 'Patient',
      filters: [
        {
          code: 'name',
          operator: Operator.EQUALS,
          value: `${name1} ${name3}`,
        },
      ],
    });
    assertOk(searchOutcome, searchResult);
    expect(searchResult.entry?.length).toEqual(1);
    expect(searchResult.entry?.[0]?.resource?.id).toEqual(patient?.id);
  });

  test('Search with commas', async () => {
    const names = [randomUUID(), randomUUID(), randomUUID()];
    const patients = [];

    for (const name of names) {
      const [createOutcome, patient] = await systemRepo.createResource<Patient>({
        resourceType: 'Patient',
        name: [{ family: name }],
      });
      assertOk(createOutcome, patient);
      patients.push(patient);
    }

    const [searchOutcome, searchResult] = await systemRepo.search({
      resourceType: 'Patient',
      filters: [
        {
          code: 'name',
          operator: Operator.EQUALS,
          value: `${names[0]},${names[1]}`,
        },
      ],
    });
    assertOk(searchOutcome, searchResult);
    expect(searchResult.entry?.length).toEqual(2);
    expect(bundleContains(searchResult, patients[0])).toBe(true);
    expect(bundleContains(searchResult, patients[1])).toBe(true);
    expect(bundleContains(searchResult, patients[2])).toBe(false);
  });

  test('Multiple names', async () => {
    const name = randomUUID();
    const other = randomUUID();

    const [createOutcome, patient] = await systemRepo.createResource<Patient>({
      resourceType: 'Patient',
      name: [
        { given: ['Alice'], family: name },
        { given: ['Alice'], family: other },
      ],
    });
    assertOk(createOutcome, patient);

    const [searchOutcome, searchResult] = await systemRepo.search({
      resourceType: 'Patient',
      filters: [
        {
          code: 'name',
          operator: Operator.EQUALS,
          value: name,
        },
      ],
    });
    assertOk(searchOutcome, searchResult);
    expect(searchResult.entry?.length).toEqual(1);
    expect(searchResult.entry?.[0]?.resource?.id).toEqual(patient.id);

    const [searchOutcome2, searchResult2] = await systemRepo.search({
      resourceType: 'Patient',
      filters: [
        {
          code: 'name',
          operator: Operator.EQUALS,
          value: other,
        },
      ],
    });
    assertOk(searchOutcome2, searchResult2);
    expect(searchResult2.entry?.length).toEqual(1);
    expect(searchResult2.entry?.[0]?.resource?.id).toEqual(patient.id);
  });

  test('Update name', async () => {
    const name1 = randomUUID();
    const name2 = randomUUID();

    const [outcome1, patient1] = await systemRepo.createResource<Patient>({
      resourceType: 'Patient',
      name: [{ given: ['Alice'], family: name1 }],
    });
    assertOk(outcome1, patient1);

    const [outcome2, bundle2] = await systemRepo.search({
      resourceType: 'Patient',
      filters: [
        {
          code: 'name',
          operator: Operator.EQUALS,
          value: name1,
        },
      ],
    });
    assertOk(outcome2, bundle2);
    expect(bundle2.entry?.length).toEqual(1);
    expect(bundle2.entry?.[0]?.resource?.id).toEqual(patient1.id);

    const [outcome3, bundle3] = await systemRepo.search({
      resourceType: 'Patient',
      filters: [
        {
          code: 'name',
          operator: Operator.EQUALS,
          value: name2,
        },
      ],
    });
    assertOk(outcome3, bundle3);
    expect(bundle3.entry?.length).toEqual(0);

    const [outcome4, patient4] = await systemRepo.updateResource<Patient>({
      ...patient1,
      name: [{ given: ['Alice'], family: name2 }],
    });
    assertOk(outcome4, patient4);

    const [outcome5, bundle5] = await systemRepo.search({
      resourceType: 'Patient',
      filters: [
        {
          code: 'name',
          operator: Operator.EQUALS,
          value: name1,
        },
      ],
    });
    assertOk(outcome5, bundle5);
    expect(bundle5.entry?.length).toEqual(0);

    const [outcome6, bundle6] = await systemRepo.search({
      resourceType: 'Patient',
      filters: [
        {
          code: 'name',
          operator: Operator.EQUALS,
          value: name2,
        },
      ],
    });
    assertOk(outcome6, bundle6);
    expect(bundle6.entry?.length).toEqual(1);
    expect(bundle6.entry?.[0]?.resource?.id).toEqual(patient1.id);
  });
});
