import { Patient, Reference, Resource, Specimen } from '@medplum/fhirtypes';
import { createScriptTag } from '@medplum/ui';

declare const grecaptcha: {
  ready: (callback: () => void) => void;
  execute: (key: string, event: any) => Promise<string>;
};

export function getPatient(resource: Resource): Patient | Reference<Patient> | undefined {
  if (resource.resourceType === 'Patient') {
    return resource;
  }
  if (
    resource.resourceType === 'DiagnosticReport' ||
    resource.resourceType === 'Encounter' ||
    resource.resourceType === 'Observation' ||
    resource.resourceType === 'ServiceRequest'
  ) {
    return resource.subject as Reference<Patient>;
  }
  return undefined;
}

export function getSpecimen(resource: Resource): Specimen | Reference<Specimen> | undefined {
  if (resource.resourceType === 'Specimen') {
    return resource;
  }
  if (resource.resourceType === 'Observation') {
    return resource.specimen;
  }
  if (resource.resourceType === 'DiagnosticReport' || resource.resourceType === 'ServiceRequest') {
    return resource.specimen?.[0];
  }
  return undefined;
}

/**
 * Dynamically loads the recaptcha script.
 * We do not want to load the script on page load unless the user needs it.
 */
export function initRecaptcha(): void {
  if (typeof grecaptcha === 'undefined') {
    createScriptTag('https://www.google.com/recaptcha/api.js?render=' + import.meta.env.VITE_RECAPTCHA_SITE_KEY);
  }
}

/**
 * Starts a request to generate a recapcha token.
 * @returns Promise to a recaptcha token for the current user.
 */
export function getRecaptcha(): Promise<string> {
  return new Promise((resolve) => {
    grecaptcha.ready(() => {
      grecaptcha.execute(import.meta.env.VITE_RECAPTCHA_SITE_KEY as string, { action: 'submit' }).then(resolve);
    });
  });
}
