import { Bundle, Patient, SearchParameter, StructureDefinition } from '@medplum/fhirtypes';
import crypto, { randomUUID } from 'crypto';
import { TextEncoder } from 'util';
import { MedplumClient } from './client';
import { Operator } from './search';
import { ProfileResource, stringify } from './utils';

const defaultOptions = {
  clientId: 'xyz',
  baseUrl: 'https://x/',
  fetch: mockFetch,
};

const patientStructureDefinition: StructureDefinition = {
  resourceType: 'StructureDefinition',
  name: 'Patient',
  snapshot: {
    element: [
      {
        path: 'Patient.id',
        type: [
          {
            code: 'code',
          },
        ],
      },
    ],
  },
};

const patientSearchParameter: SearchParameter = {
  resourceType: 'SearchParameter',
  id: 'Patient-name',
  base: ['Patient'],
  code: 'name',
  name: 'name',
  expression: 'Patient.name',
};

const schemaResponse = {
  data: {
    StructureDefinitionList: [patientStructureDefinition],
    SearchParameterList: [patientSearchParameter],
  },
};

const emptyBundle: Bundle = {
  resourceType: 'Bundle',
  entry: [],
};

let canRefresh = true;
let tokenExpired = false;

function mockFetch(url: string, options: any): Promise<any> {
  const { method } = options;

  let result: any;

  if (method === 'POST' && url.endsWith('auth/login')) {
    result = {
      login: '123',
      code: '123',
    };
  } else if (method === 'POST' && url.endsWith('auth/google')) {
    result = {
      login: '123',
      code: '123',
    };
  } else if (method === 'POST' && url.endsWith('auth/register')) {
    result = {
      status: 200,
      access_token: 'header.' + window.btoa(stringify({ client_id: defaultOptions.clientId })) + '.signature',
      refresh_token: 'header.' + window.btoa(stringify({ client_id: defaultOptions.clientId })) + '.signature',
      project: {
        reference: 'Project/123',
      },
      profile: {
        reference: 'Practitioner/123',
      },
    };
  } else if (method === 'GET' && url.endsWith('auth/me')) {
    result = {
      profile: {
        resourceType: 'Practitioner',
        id: '123',
      },
      config: {
        resourceType: 'UserConfiguration',
        id: '123',
        menu: [
          {
            title: 'My Menu',
            link: [
              {
                name: 'My Link',
                target: '/my-target',
              },
            ],
          },
        ],
      },
    };
  } else if (method === 'GET' && url.endsWith('Practitioner/123')) {
    result = {
      resourceType: 'Practitioner',
      id: '123',
    };
  } else if (method === 'GET' && url.endsWith('Patient/123')) {
    result = {
      resourceType: 'Patient',
      id: '123',
    };
  } else if (method === 'GET' && url.endsWith('Patient?_count=1&name:contains=alice')) {
    result = {
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: '123',
          },
        },
      ],
    };
  } else if (method === 'POST' && url.endsWith('oauth2/token')) {
    if (canRefresh) {
      result = {
        status: 200,
        access_token: 'header.' + window.btoa(stringify({ client_id: defaultOptions.clientId })) + '.signature',
        refresh_token: 'header.' + window.btoa(stringify({ client_id: defaultOptions.clientId })) + '.signature',
      };
    } else {
      result = {
        status: 400,
      };
    }
  } else if (method === 'GET' && url.includes('expired')) {
    if (tokenExpired) {
      result = {
        status: 401,
      };
      tokenExpired = false;
    } else {
      result = {
        ok: true,
      };
    }
  } else if (method === 'GET' && url.endsWith('/fhir/R4/StructureDefinition?_count=1&name:exact=')) {
    result = emptyBundle;
  } else if (method === 'GET' && url.endsWith('/fhir/R4/StructureDefinition?_count=1&name:exact=DoesNotExist')) {
    result = emptyBundle;
  } else if (method === 'PUT' && url.endsWith('Patient/777')) {
    result = {
      status: 304, // Not modified
    };
  } else if (method === 'PUT' && url.endsWith('Patient/888')) {
    result = {
      status: 400,
      resourceType: 'OperationOutcome',
      id: 'bad-request',
    };
  } else if (method === 'GET' && url.endsWith('ValueSet/%24expand?url=system&filter=filter')) {
    result = {
      resourceType: 'ValueSet',
    };
  } else if (method === 'POST' && url.endsWith('fhir/R4/%24graphql')) {
    result = schemaResponse;
  }

  const response: any = {
    request: {
      url,
      options,
    },
    ...result,
  };

  return Promise.resolve({
    ok: response.status === 200 || response.status === undefined,
    status: response.status,
    blob: () => Promise.resolve(response),
    json: () => Promise.resolve(response),
  });
}

describe('Client', () => {
  beforeAll(() => {
    Object.defineProperty(global, 'TextEncoder', {
      value: TextEncoder,
    });

    Object.defineProperty(global.self, 'crypto', {
      value: crypto.webcrypto,
    });
  });

  beforeEach(() => {
    localStorage.clear();
    canRefresh = true;
    tokenExpired = false;
  });

  test('Constructor', () => {
    expect(
      () =>
        new MedplumClient({
          clientId: 'xyz',
          baseUrl: 'x',
        })
    ).toThrow('Base URL must start with http or https');

    expect(
      () =>
        new MedplumClient({
          clientId: 'xyz',
          baseUrl: 'https://x',
        })
    ).toThrow('Base URL must end with a trailing slash');

    expect(
      () =>
        new MedplumClient({
          clientId: 'xyz',
          baseUrl: 'https://x/',
        })
    ).toThrow();

    expect(
      () =>
        new MedplumClient({
          clientId: 'xyz',
          baseUrl: 'https://x/',
          fetch: mockFetch,
        })
    ).not.toThrow();

    expect(
      () =>
        new MedplumClient({
          fetch: mockFetch,
        })
    ).not.toThrow();

    window.fetch = jest.fn();
    expect(() => new MedplumClient()).not.toThrow();
  });

  test('Restore from localStorage', async () => {
    window.localStorage.setItem(
      'activeLogin',
      JSON.stringify({
        accessToken: '123',
        refreshToken: '456',
        project: {
          reference: 'Project/123',
        },
        profile: {
          reference: 'Practitioner/123',
        },
      })
    );

    const client = new MedplumClient(defaultOptions);
    expect(client.isLoading()).toBe(true);
    expect(client.getProfile()).toBeUndefined();
    expect(client.getProfileAsync()).toBeDefined();
    expect(client.getUserConfiguration()).toBeUndefined();

    const profile = (await client.getProfileAsync()) as ProfileResource;
    expect(client.isLoading()).toBe(false);
    expect(profile.id).toBe('123');
    expect(client.getProfileAsync()).toBeDefined();
    expect(client.getUserConfiguration()).toBeDefined();
  });

  test('Clear', () => {
    const client = new MedplumClient(defaultOptions);
    expect(() => client.clear()).not.toThrow();
  });

  test('SignOut', () => {
    const client = new MedplumClient(defaultOptions);
    expect(() => client.signOut()).not.toThrow();
    expect(client.getActiveLogin()).toBeUndefined();
    expect(client.getProfile()).toBeUndefined();
  });

  test('SignIn direct', async () => {
    const client = new MedplumClient(defaultOptions);
    const result1 = await client.startLogin({ email: 'admin@example.com', password: 'admin' });
    expect(result1).toBeDefined();
    expect(result1.login).toBeDefined();
    expect(result1.code).toBeDefined();
  });

  test('Sign in with Google', async () => {
    const client = new MedplumClient(defaultOptions);
    const result1 = await client.startGoogleLogin({
      clientId: 'google-client-id',
      credential: 'google-credential',
    });
    expect(result1).toBeDefined();
    expect(result1.login).toBeDefined();
  });

  test('SignInWithRedirect', async () => {
    // Mock window.location.assign
    global.window = Object.create(window);
    Object.defineProperty(window, 'location', {
      value: {
        assign: jest.fn(),
      },
      writable: true,
    });

    const client = new MedplumClient(defaultOptions);

    // First, test the initial reidrect
    const result1 = client.signInWithRedirect();
    expect(result1).toBeUndefined();

    // Mock response code
    Object.defineProperty(window, 'location', {
      value: {
        assign: jest.fn(),
        search: new URLSearchParams({ code: 'test-code' }),
      },
      writable: true,
    });

    // Next, test processing the response code
    const result2 = client.signInWithRedirect();
    expect(result2).toBeDefined();
  });

  test('SignOutWithRedirect', async () => {
    // Mock window.location.assign
    global.window = Object.create(window);
    Object.defineProperty(window, 'location', {
      value: {
        assign: jest.fn(),
      },
      writable: true,
    });

    const client = new MedplumClient(defaultOptions);
    client.signOutWithRedirect();
    expect(window.location.assign).toBeCalled();
  });

  test('Register', async () => {
    const client = new MedplumClient(defaultOptions);
    await client.register({
      email: `sally${randomUUID()}@example.com`,
      password: 'testtest',
      firstName: 'Sally',
      lastName: 'Foo',
      projectName: 'Sally World',
      recaptchaToken: 'xyz',
    });
    expect(client.getActiveLogin()).toBeDefined();
  });

  test('HTTP GET', async () => {
    const client = new MedplumClient(defaultOptions);
    const request1 = client.get('Practitioner/123');
    const request2 = client.get('Practitioner/123');
    expect(request2).toBe(request1);

    const request3 = client.get('Practitioner/123', { cache: 'reload' });
    expect(request3).not.toBe(request1);
  });

  test('Read expired and refresh', async () => {
    tokenExpired = true;

    const client = new MedplumClient(defaultOptions);

    const loginResponse = await client.startLogin({ email: 'admin@example.com', password: 'admin' });
    await client.processCode(loginResponse.code as string);

    const result = await client.get('expired');
    expect(result).toBeDefined();
  });

  test('Read expired and refresh with unAuthenticated callback', async () => {
    tokenExpired = true;
    canRefresh = false;

    const onUnauthenticated = jest.fn();
    const client = new MedplumClient({ ...defaultOptions, onUnauthenticated });
    const loginResponse = await client.startLogin({ email: 'admin@example.com', password: 'admin' });
    await expect(client.processCode(loginResponse.code as string)).rejects.toEqual('Failed to fetch tokens');

    const result = client.get('expired');
    await expect(result).rejects.toEqual('Invalid refresh token');
    expect(onUnauthenticated).toBeCalled();
  });

  test('Read resource', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.readResource('Patient', '123');
    expect(result).toBeDefined();
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient/123');
    expect(result.resourceType).toBe('Patient');
    expect(result.id).toBe('123');
  });

  test('Read reference', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.readReference({ reference: 'Patient/123' });
    expect(result).toBeDefined();
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient/123');
    expect(result.resourceType).toBe('Patient');
    expect(result.id).toBe('123');
  });

  test('Read empty reference', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = client.readReference({});
    expect(result).rejects.toEqual('Missing reference');
  });

  test('Read cached resource', async () => {
    const client = new MedplumClient(defaultOptions);
    expect(client.getCached('Patient', '123')).toBeUndefined(); // Nothing in the cache
    const readPromise = client.readCached('Patient', '123');
    expect(client.getCached('Patient', '123')).toBeUndefined(); // Promise in the cache
    const result = await readPromise;
    expect(result).toBeDefined();
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient/123');
    expect(result.resourceType).toBe('Patient');
    expect(result.id).toBe('123');
    expect(client.getCached('Patient', '123')).toBe(result); // Value in the cache
  });

  test('Read cached reference', async () => {
    const client = new MedplumClient(defaultOptions);
    const reference = { reference: 'Patient/123' };
    expect(client.getCachedReference(reference)).toBeUndefined();
    const readPromise = client.readCachedReference(reference);
    expect(client.getCachedReference(reference)).toBeUndefined(); // Promise in the cache
    const result = await readPromise;
    expect(result).toBeDefined();
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient/123');
    expect(result.resourceType).toBe('Patient');
    expect(result.id).toBe('123');
    expect(client.getCachedReference(reference)).toBe(result);
  });

  test('Read cached empty reference', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = client.readCachedReference({});
    expect(result).rejects.toEqual('Missing reference');
  });

  test('Read history', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.readHistory('Patient', '123');
    expect(result).toBeDefined();
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient/123/_history');
  });

  test('Read patient everything', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.readPatientEverything('123');
    expect(result).toBeDefined();
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient/123/%24everything');
  });

  test('Create resource', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.createResource({ resourceType: 'Patient' });
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('POST');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient');
  });

  test('Create resource if none exist returns existing', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.createResourceIfNoneExist<Patient>(
      {
        resourceType: 'Patient',
        name: [{ given: ['Alice'], family: 'Smith' }],
      },
      'name:contains=alice'
    );
    expect(result).toBeDefined();
    expect(result.id).toBe('123'); // Expect existing patient
  });

  test('Create resource if none exist creates new', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.createResourceIfNoneExist<Patient>(
      {
        resourceType: 'Patient',
        name: [{ given: ['Bob'], family: 'Smith' }],
      },
      'name:contains=bob'
    );
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('POST');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient');
  });

  test('Update resource', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.updateResource({ resourceType: 'Patient', id: '123' });
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('PUT');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient/123');
  });

  test('Not modified', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.updateResource({ resourceType: 'Patient', id: '777' });
    expect(result).toBeUndefined();
  });

  test('Bad Request', async () => {
    const client = new MedplumClient(defaultOptions);
    const promise = client.updateResource({ resourceType: 'Patient', id: '888' });
    expect(promise).rejects.toMatchObject({});
  });

  test('Create resource', async () => {
    const client = new MedplumClient(defaultOptions);
    expect(client.createResource({} as Patient)).rejects.toEqual('Missing resourceType');
    const result = await client.createResource({ resourceType: 'Patient', name: [{ family: 'Smith' }] });
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('POST');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient');
  });

  test('Create binary', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.createBinary('Hello world', undefined, 'text/plain');
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('POST');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Binary');
  });

  test('Create binary with filename', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.createBinary('Hello world', 'hello.txt', 'text/plain');
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('POST');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Binary?_filename=hello.txt');
  });

  test('Create pdf', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.createPdf({ content: ['Hello world'] });
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('POST');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Binary/$pdf');
  });

  test('Create pdf with filename', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.createPdf({ content: ['Hello world'] }, 'report.pdf');
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('POST');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Binary/$pdf?_filename=report.pdf');
  });

  test('Update resource', async () => {
    const client = new MedplumClient(defaultOptions);
    expect(client.updateResource({} as Patient)).rejects.toEqual('Missing resourceType');
    expect(client.updateResource({ resourceType: 'Patient' })).rejects.toEqual('Missing id');
    const result = await client.updateResource({ resourceType: 'Patient', id: '123', name: [{ family: 'Smith' }] });
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('PUT');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient/123');
  });

  test('Patch resource', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.patchResource('Patient', '123', []);
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('PATCH');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient/123');
  });

  test('Delete resource', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.deleteResource('Patient', 'xyz');
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('DELETE');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient/xyz');
  });

  test('Request schema', async () => {
    const client = new MedplumClient(defaultOptions);
    expect(client.getSchema()).toBeDefined();
    expect(client.getSchema().types['Patient']).toBeUndefined();
    const schema = await client.requestSchema('Patient');
    expect(schema).toBeDefined();
    expect(schema.types['Patient']).toBeDefined();
    expect(schema.types['Patient'].searchParams).toBeDefined();
  });

  test('Get cached schema', async () => {
    const client = new MedplumClient(defaultOptions);
    const schema = await client.requestSchema('Patient');
    expect(schema).toBeDefined();
    expect(schema.types['Patient']).toBeDefined();

    const schema2 = await client.requestSchema('Patient');
    expect(schema2).toEqual(schema);
  });

  test('Search', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.search({
      resourceType: 'Patient',
      filters: [{ code: 'name', operator: Operator.CONTAINS, value: 'alice' }],
    });
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('GET');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient?name:contains=alice');
  });

  test('Search by query', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.search('Patient?name:contains=alice');
    expect(result).toBeDefined();
    expect((result as any).request.options.method).toBe('GET');
    expect((result as any).request.url).toBe('https://x/fhir/R4/Patient?name:contains=alice');
  });

  test('Search one', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.searchOne({
      resourceType: 'Patient',
      filters: [{ code: 'name', operator: Operator.CONTAINS, value: 'alice' }],
    });
    expect(result).toBeDefined();
    expect(result?.resourceType).toBe('Patient');
  });

  test('Search one by query', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.searchOne('Patient?name:contains=alice');
    expect(result).toBeDefined();
    expect(result?.resourceType).toBe('Patient');
  });

  test('Search resources', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.searchResources({
      resourceType: 'Patient',
      count: 1,
      filters: [{ code: 'name', operator: Operator.CONTAINS, value: 'alice' }],
    });
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].resourceType).toBe('Patient');
  });

  test('Search resources by query', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.searchResources('Patient?_count=1&name:contains=alice');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].resourceType).toBe('Patient');
  });

  test('Search ValueSet', async () => {
    const client = new MedplumClient(defaultOptions);
    const result = await client.searchValueSet('system', 'filter');
    expect(result).toBeDefined();
    expect(result.resourceType).toBe('ValueSet');
  });

  test('Storage events', async () => {
    // Make window.location writeable
    Object.defineProperty(window, 'location', {
      value: { assign: {} },
      writable: true,
    });

    const mockAddEventListener = jest.fn();
    const mockReload = jest.fn();

    window.addEventListener = mockAddEventListener;
    window.location.reload = mockReload;

    const client = new MedplumClient(defaultOptions);
    expect(client).toBeDefined();
    expect(mockAddEventListener).toHaveBeenCalled();
    expect(mockAddEventListener.mock.calls[0][0]).toBe('storage');

    const callback = mockAddEventListener.mock.calls[0][1];

    mockReload.mockReset();
    callback({ key: 'randomKey' });
    expect(mockReload).not.toHaveBeenCalled();

    mockReload.mockReset();
    callback({ key: 'activeLogin' });
    expect(mockReload).toHaveBeenCalled();

    mockReload.mockReset();
    callback({ key: null });
    expect(mockReload).toHaveBeenCalled();
  });

  test('setAccessToken', async () => {
    const fetch = jest.fn(async () => ({
      json: async () => ({ resourceType: 'Patient' }),
    }));

    const client = new MedplumClient({ fetch });
    client.setAccessToken('foo');

    const patient = await client.readResource('Patient', '123');
    expect(patient).toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch.mock.calls[0] as any[])[1].headers.Authorization).toBe('Bearer foo');
  });
});
