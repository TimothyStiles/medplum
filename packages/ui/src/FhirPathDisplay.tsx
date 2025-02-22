import { PropertyType } from '@medplum/core';
import { evalFhirPath } from '@medplum/fhirpath';
import { Resource } from '@medplum/fhirtypes';
import React from 'react';
import { ResourcePropertyDisplay } from './ResourcePropertyDisplay';

export interface FhirPathDisplayProps {
  resource: Resource;
  path: string;
  propertyType: PropertyType;
}

export function FhirPathDisplay(props: FhirPathDisplayProps): JSX.Element {
  const value = evalFhirPath(props.path, props.resource);

  if (value.length > 1) {
    throw new Error(
      `Component "path" for "FhirPathDisplay" must resolve to a single element. \
       Received ${value.length} elements \
       [${JSON.stringify(value, null, 2)}]`
    );
  }
  return <ResourcePropertyDisplay value={value[0] || ''} propertyType={props.propertyType} />;
}
