import { GoogleCredentialResponse, LoginAuthenticationResponse } from '@medplum/core';
import React, { useEffect, useRef, useState } from 'react';
import { useMedplum } from './MedplumProvider';
import { createScriptTag } from './utils';

interface GoogleApi {
  accounts: {
    id: {
      initialize: (args: any) => void;
      renderButton: (parent: HTMLElement, args: any) => void;
    };
  };
}

declare const google: GoogleApi;

export interface GoogleButtonProps {
  googleClientId?: string;
  handleAuthResponse: (response: LoginAuthenticationResponse) => void;
}

export function GoogleButton(props: GoogleButtonProps): JSX.Element | null {
  const medplum = useMedplum();
  const { handleAuthResponse } = props;
  const googleClientId = getGoogleClientId(props.googleClientId);
  const parentRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(typeof google !== 'undefined');
  const [initialized, setInitialized] = useState<boolean>(false);
  const [buttonRendered, setButtonRendered] = useState<boolean>(false);

  useEffect(() => {
    if (typeof google === 'undefined') {
      createScriptTag('https://accounts.google.com/gsi/client', () => setScriptLoaded(true));
      return;
    }

    if (!initialized) {
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response: GoogleCredentialResponse) => medplum.startGoogleLogin(response).then(handleAuthResponse),
      });
      setInitialized(true);
    }

    if (parentRef.current && !buttonRendered) {
      google.accounts.id.renderButton(parentRef.current, {});
      setButtonRendered(true);
    }
  }, [medplum, googleClientId, initialized, scriptLoaded, parentRef, buttonRendered, handleAuthResponse]);

  if (!googleClientId) {
    return null;
  }

  return <div ref={parentRef} />;
}

export function getGoogleClientId(clientId: string | undefined): string | undefined {
  if (clientId) {
    return clientId;
  }

  const origin = window.location.protocol + '//' + window.location.host;
  const authorizedOrigins = process.env.GOOGLE_AUTH_ORIGINS?.split(',') ?? [];
  if (authorizedOrigins.includes(origin)) {
    return process.env.GOOGLE_CLIENT_ID;
  }

  return undefined;
}
