import { MemoizedFhirPathTable, SmartSearchField } from '@medplum/ui';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function SmartSearchPage(): JSX.Element | null {
  const navigate = useNavigate();
  const location = useLocation();
  const [resourceType, setResourceType] = useState<string>();
  const [query, setQuery] = useState<string>();
  const [fields, setFields] = useState<SmartSearchField[]>();

  useEffect(() => {
    const queryParams = Object.fromEntries(new URLSearchParams(location.search).entries()) as Record<string, string>;
    setResourceType(queryParams.resourceType);
    setQuery(queryParams.query);
    setFields(JSON.parse(queryParams.fields));
  }, [location]);

  if (!resourceType || !query || !fields) {
    return null;
  }

  return (
    <MemoizedFhirPathTable
      resourceType={resourceType}
      checkboxesEnabled={true}
      query={query}
      fields={fields}
      onClick={(e) => navigate(`/${e.resource.resourceType}/${e.resource.id}`)}
      onAuxClick={(e) => window.open(`/${e.resource.resourceType}/${e.resource.id}`, '_blank')}
      onBulk={(ids: string[]) => {
        navigate(`/bulk/${resourceType}?ids=${ids.join(',')}`);
      }}
    />
  );
}
