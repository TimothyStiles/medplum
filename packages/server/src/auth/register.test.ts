import { assertOk, badRequest, createReference, resolveId } from '@medplum/core';
import { Patient } from '@medplum/fhirtypes';
import { randomUUID } from 'crypto';
import express from 'express';
import { pwnedPassword } from 'hibp';
import fetch from 'node-fetch';
import request from 'supertest';
import { initApp } from '../app';
import { loadTestConfig } from '../config';
import { closeDatabase, initDatabase } from '../database';
import { systemRepo } from '../fhir';
import { setupPwnedPasswordMock, setupRecaptchaMock } from '../test.setup';
import { initKeys } from '../oauth';
import { seedDatabase } from '../seed';

jest.mock('hibp');
jest.mock('node-fetch');

const app = express();

describe('Register', () => {
  beforeAll(async () => {
    const config = await loadTestConfig();
    await initDatabase(config.database);
    await seedDatabase();
    await initApp(app);
    await initKeys(config);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach(async () => {
    (fetch as unknown as jest.Mock).mockClear();
    (pwnedPassword as unknown as jest.Mock).mockClear();
    setupPwnedPasswordMock(pwnedPassword as unknown as jest.Mock, 0);
    setupRecaptchaMock(fetch as unknown as jest.Mock, true);
  });

  test('Success', async () => {
    const res = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Alexander',
        lastName: 'Hamilton',
        projectName: 'Hamilton Project',
        email: `alex${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });

    expect(res.status).toBe(200);
    expect(res.body.profile).toBeDefined();
    expect(res.body.idToken).toBeDefined();
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  test('Both project ID and project name', async () => {
    const res = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Alexander',
        lastName: 'Hamilton',
        projectId: randomUUID(),
        projectName: 'Hamilton Project',
        email: `alex${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });

    expect(res.status).toBe(400);
    expect(res.body.issue[0].details.text).toBe('Cannot specify both projectId and projectName');
  });

  test('Neither project ID nor project name', async () => {
    const res = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Alexander',
        lastName: 'Hamilton',
        projectId: '',
        projectName: '',
        email: `alex${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });

    expect(res.status).toBe(400);
    expect(res.body.issue[0].details.text).toBe('Must provide either projectId or projectName');
  });

  test('Missing recaptcha', async () => {
    const res = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Alexander',
        lastName: 'Hamilton',
        projectName: 'Hamilton Project',
        email: `alex${randomUUID()}@example.com`,
        password: 'password!@#',
      });

    expect(res.status).toBe(400);
    expect(res.body.issue[0].details.text).toBe('Recaptcha token is required');
  });

  test('Incorrect recaptcha', async () => {
    setupRecaptchaMock(fetch as unknown as jest.Mock, false);

    const res = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Alexander',
        lastName: 'Hamilton',
        projectName: 'Hamilton Project',
        email: `alex${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'wrong',
      });

    expect(res.status).toBe(400);
    expect(res.body.issue[0].details.text).toBe('Recaptcha failed');
  });

  test('Breached password', async () => {
    // Mock the pwnedPassword function to return "1", meaning the password is breached.
    setupPwnedPasswordMock(pwnedPassword as unknown as jest.Mock, 1);

    const res = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Alexander',
        lastName: 'Hamilton',
        projectName: 'Hamilton Project',
        email: `alex${randomUUID()}@example.com`,
        password: 'breached',
        recaptchaToken: 'wrong',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject(badRequest('Password found in breach database', 'password'));
  });

  test('Email already registered', async () => {
    const registerRequest = {
      firstName: 'George',
      lastName: 'Washington',
      projectName: 'Washington Project',
      email: `george${randomUUID()}@example.com`,
      password: 'password!@#',
      recaptchaToken: 'xyz',
    };

    const res = await request(app).post('/auth/register').type('json').send(registerRequest);
    expect(res.status).toBe(200);
    expect(res.body.project.reference).toBeDefined();
    expect(res.body.profile.reference).toBeDefined();

    const res2 = await request(app).post('/auth/register').type('json').send(registerRequest);
    expect(res2.status).toBe(200);
    expect(res2.body.project.reference).toBeDefined();
    expect(res2.body.project.reference).not.toEqual(res.body.project.reference);
    expect(res2.body.profile.reference).toBeDefined();
    expect(res2.body.profile.reference).not.toEqual(res.body.profile.reference);
  });

  test('Cannot access Project resource', async () => {
    const res = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Alexander',
        lastName: 'Hamilton',
        projectName: 'Hamilton Project',
        email: `alex${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });

    expect(res.status).toBe(200);
    expect(res.body.project.reference).toBeDefined();

    const res2 = await request(app)
      .get(`/fhir/R4/${res.body.project.reference}`)
      .set('Authorization', 'Bearer ' + res.body.accessToken);

    expect(res2.status).toBe(403);

    const res3 = await request(app)
      .post(`/fhir/R4/Project`)
      .set('Authorization', 'Bearer ' + res.body.accessToken)
      .type('json')
      .send({
        resourceType: 'Project',
        name: 'Project 1',
        owner: { reference: 'Project/' + randomUUID() },
      });

    expect(res3.status).toBe(403);
  });

  test('Cannot access ProjectMembership resource', async () => {
    const res = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Alexander',
        lastName: 'Hamilton',
        projectName: 'Hamilton Project',
        email: `alex${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });

    expect(res.status).toBe(200);
    expect(res.body.project.reference).toBeDefined();

    const res2 = await request(app)
      .get(`/fhir/R4/ProjectMembership`)
      .set('Authorization', 'Bearer ' + res.body.accessToken);

    expect(res2.status).toBe(403);

    const res3 = await request(app)
      .post(`/fhir/R4/ProjectMembership`)
      .set('Authorization', 'Bearer ' + res.body.accessToken)
      .type('json')
      .send({
        resourceType: 'ProjectMembership',
        project: { reference: 'Project/' + randomUUID() },
        user: { reference: 'Project/' + randomUUID() },
        profile: { reference: 'Project/' + randomUUID() },
      });

    expect(res3.status).toBe(403);
  });

  test('Can access Practitioner resource', async () => {
    const res = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Alexander',
        lastName: 'Hamilton',
        projectName: 'Hamilton Project',
        email: `alex${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.reference).toBeDefined();

    const res2 = await request(app)
      .get(`/fhir/R4/${res.body.profile.reference}`)
      .set('Authorization', 'Bearer ' + res.body.accessToken);

    expect(res2.status).toBe(200);
  });

  test('Default ClientApplication', async () => {
    const res = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Alexander',
        lastName: 'Hamilton',
        projectName: 'Hamilton Project',
        email: `alex${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });

    expect(res.status).toBe(200);
    expect(res.body.profile).toBeDefined();
    expect(res.body.client).toBeDefined();

    const res2 = await request(app)
      .get(`/fhir/R4/ClientApplication`)
      .set('Authorization', 'Bearer ' + res.body.accessToken);

    expect(res2.status).toBe(200);
    expect(res2.body.entry.length).toBe(1);
  });

  test('ClientApplication is restricted to project', async () => {
    // User1 registers
    // User1 creates a patient
    // User2 registers
    // User2 creates a client
    // Client should not be able to see User1 patients
    // Client should not see User1 patients in search
    const res = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'User1',
        lastName: 'User1',
        projectName: 'User1 Project',
        email: `user1-${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });

    expect(res.status).toBe(200);
    expect(res.body.profile).toBeDefined();

    const patient: Patient = {
      resourceType: 'Patient',
      name: [
        {
          given: ['Patient1'],
          family: 'Patient1',
        },
      ],
    };

    const res2 = await request(app)
      .post(`/fhir/R4/Patient`)
      .set('Authorization', 'Bearer ' + res.body.accessToken)
      .type('json')
      .send(patient);

    expect(res2.status).toBe(201);

    const res3 = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'User2',
        lastName: 'User2',
        projectName: 'User2 Project',
        email: `user2-${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });

    expect(res3.status).toBe(200);
    expect(res3.body.project).toBeDefined();
    expect(res3.body.client).toBeDefined();
    expect(res3.body.profile).toBeDefined();

    // Try to access User1 patient using User2 directly
    // This should fail
    const res4 = await request(app)
      .get(`/fhir/R4/Patient/${res2.body.id}`)
      .set('Authorization', 'Bearer ' + res3.body.accessToken);
    expect(res4.status).toBe(404);

    // Get the client
    const res5 = await request(app)
      .get(`/fhir/R4/ClientApplication/${resolveId(res3.body.client)}`)
      .set('Authorization', 'Bearer ' + res3.body.accessToken);
    expect(res5.status).toBe(200);

    // Get a token using the client
    const res6 = await request(app).post('/oauth2/token').type('form').send({
      grant_type: 'client_credentials',
      client_id: res5.body.id,
      client_secret: res5.body.secret,
    });
    expect(res6.status).toBe(200);
    expect(res6.body.error).toBeUndefined();
    expect(res6.body.access_token).toBeDefined();

    // Try to access User1 patient using User2 directly
    // This should fail
    const res7 = await request(app)
      .get(`/fhir/R4/Patient/${res2.body.id}`)
      .set('Authorization', 'Bearer ' + res6.body.access_token);
    expect(res7.status).toBe(404);

    // Try to search for patients using User2 client
    // This should return empty set
    const res8 = await request(app)
      .get(`/fhir/R4/Patient`)
      .set('Authorization', 'Bearer ' + res6.body.access_token);
    expect(res8.status).toBe(200);
    expect(res8.body.entry.length).toEqual(0);
  });

  test('GraphQL is restricted to project', async () => {
    // User1 registers
    // User1 creates a patient
    // User2 registers
    // User2 should not see User1 patients in search
    // User2 should not be able to see User1 patients by GraphQL
    const res = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'User1',
        lastName: 'User1',
        projectName: 'User1 Project',
        email: `user1-${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });

    expect(res.status).toBe(200);
    expect(res.body.profile).toBeDefined();

    const patient: Patient = {
      resourceType: 'Patient',
      name: [
        {
          given: ['Patient1'],
          family: 'Patient1',
        },
      ],
    };

    const res2 = await request(app)
      .post(`/fhir/R4/Patient`)
      .set('Authorization', 'Bearer ' + res.body.accessToken)
      .type('json')
      .send(patient);

    expect(res2.status).toBe(201);

    const res3 = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'User2',
        lastName: 'User2',
        projectName: 'User2 Project',
        email: `user2-${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });

    expect(res3.status).toBe(200);
    expect(res3.body.profile).toBeDefined();

    // Try to access User1 patient using User2 directly
    // This should fail
    const res4 = await request(app)
      .get(`/fhir/R4/Patient/${res2.body.id}`)
      .set('Authorization', 'Bearer ' + res3.body.accessToken);
    expect(res4.status).toBe(404);

    // Try to access User1 patient using User2 graphql
    // This should fail
    const res5 = await request(app)
      .post(`/fhir/R4/$graphql`)
      .set('Authorization', 'Bearer ' + res3.body.accessToken)
      .type('json')
      .send({
        query: `{
          PatientList(name:"Patient1") {
            name {
              family
            }
          }
        }`,
      });
    expect(res5.status).toBe(200);
    expect(res5.body.data).toBeDefined();
    expect(res5.body.data.PatientList).toBeDefined();
    expect(res5.body.data.PatientList.length).toEqual(0);
  });

  test('Patient registration', async () => {
    // Register as Christina
    const res1 = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Christina',
        lastName: 'Smith',
        projectName: 'Christina Project',
        email: `christina${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });
    expect(res1.status).toBe(200);
    expect(res1.body.project.reference).toBeDefined();

    const projectId = res1.body.project.reference.replace('Project/', '');

    // Try to register as a patient in the new project
    // (This should fail)
    const res2 = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Peggy',
        lastName: 'Patient',
        projectId,
        email: `peggy${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });
    expect(res2.status).toBe(400);

    // As Christina, create a default access policy for new patients
    const res3 = await request(app)
      .post(`/fhir/R4/AccessPolicy`)
      .set('Authorization', 'Bearer ' + res1.body.accessToken)
      .type('json')
      .send({
        resourceType: 'AccessPolicy',
        name: 'Default Patient Policy',
      });
    expect(res3.status).toBe(201);

    // As a super admin, enable patient registration
    const [updateOutcome, updatedProject] = await systemRepo.patchResource('Project', projectId, [
      {
        op: 'add',
        path: '/defaultPatientAccessPolicy',
        value: createReference(res3.body),
      },
    ]);
    assertOk(updateOutcome, updatedProject);

    // Try to register as a patient in the new project
    // (This should succeed)
    const res4 = await request(app)
      .post('/auth/register')
      .type('json')
      .send({
        firstName: 'Peggy',
        lastName: 'Patient',
        projectId,
        email: `peggy${randomUUID()}@example.com`,
        password: 'password!@#',
        recaptchaToken: 'xyz',
      });
    expect(res4.status).toBe(200);
  });
});
