import { formatAddress, stringify } from '@medplum/core';
import { Address, Resource, SearchParameter } from '@medplum/fhirtypes';
import { randomUUID } from 'crypto';
import { getClient } from '../../database';
import { InsertQuery } from '../sql';
import { LookupTable } from './lookuptable';
import { compareArrays } from './util';

/**
 * The AddressTable class is used to index and search "name" properties on "Person" resources.
 * Each name is represented as a separate row in the "Address" table.
 */
export class AddressTable extends LookupTable<Address> {
  static readonly #knownParams: Set<string> = new Set<string>([
    'individual-address',
    'individual-address-city',
    'individual-address-country',
    'individual-address-postalcode',
    'individual-address-state',
    'individual-address-use',
    'InsurancePlan-address',
    'InsurancePlan-address-city',
    'InsurancePlan-address-country',
    'InsurancePlan-address-postalcode',
    'InsurancePlan-address-state',
    'InsurancePlan-address-use',
    'Location-address',
    'Location-address-city',
    'Location-address-country',
    'Location-address-postalcode',
    'Location-address-state',
    'Location-address-use',
    'Organization-address',
    'Organization-address-city',
    'Organization-address-country',
    'Organization-address-postalcode',
    'Organization-address-state',
    'Organization-address-use',
  ]);

  /**
   * Returns the table name.
   * @returns The table name.
   */
  getTableName(): string {
    return 'Address';
  }

  /**
   * Returns the column name for the address.
   *
   *   Input              | Output
   *  --------------------+-----------
   *   address            | address
   *   address-city       | city
   *   address-country    | country
   *   address-postalcode | postalcode
   *   address-state      | state
   *   addrses-use        | use
   *
   * @param code The search parameter code.
   * @returns The column name.
   */
  getColumnName(code: string): string {
    return code === 'address' ? 'address' : code.replace('address-', '');
  }

  /**
   * Returns true if the search parameter is an "" parameter.
   * @param searchParam The search parameter.
   * @returns True if the search parameter is an "identifier" parameter.
   */
  isIndexed(searchParam: SearchParameter): boolean {
    return AddressTable.#knownParams.has(searchParam.id as string);
  }

  /**
   * Indexes a resource identifier values.
   * Attempts to reuse existing identifiers if they are correct.
   * @param resource The resource to index.
   * @returns Promise on completion.
   */
  async indexResource(resource: Resource): Promise<void> {
    const addresses = this.#getIncomingAddresses(resource);
    if (!addresses || !Array.isArray(addresses)) {
      return;
    }

    const resourceId = resource.id as string;
    const existing = await this.getExistingValues(resourceId);

    if (!compareArrays(addresses, existing)) {
      const client = getClient();

      if (existing.length > 0) {
        await this.deleteValuesForResource(resource);
      }

      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        await new InsertQuery('Address', {
          id: randomUUID(),
          resourceId,
          index: i,
          content: stringify(address),
          address: formatAddress(address),
          city: address.city,
          country: address.country,
          postalCode: address.postalCode,
          state: address.state,
          use: address.use,
        }).execute(client);
      }
    }
  }

  #getIncomingAddresses(resource: Resource): Address[] | undefined {
    if (
      resource.resourceType === 'Patient' ||
      resource.resourceType === 'Person' ||
      resource.resourceType === 'Practitioner' ||
      resource.resourceType === 'RelatedPerson'
    ) {
      return resource.address;
    }

    if (resource.resourceType === 'InsurancePlan') {
      return resource.contact?.map((contact) => contact.address).filter((address) => !!address) as
        | Address[]
        | undefined;
    }

    if (resource.resourceType === 'Location') {
      return resource.address ? [resource.address] : undefined;
    }

    if (resource.resourceType === 'Organization') {
      return resource.address;
    }

    // This resource does not have any address properties
    return undefined;
  }
}
