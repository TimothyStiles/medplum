import { SandpackLayout, SandpackPreview, SandpackProvider, useSandpack } from '@codesandbox/sandpack-react';
import '@codesandbox/sandpack-react/dist/index.css';
import React from 'react';

const APP_CODE = `
import { sum } from 'lodash';

export default function App() {
  return <>
    <h1>Hello Sandpack!</h1>
    <h2>{sum([2, 3])}</h2>
  </>
}
`.trim();

function Editor(): JSX.Element {
  const { sandpack } = useSandpack();

  return (
    <textarea
      style={{ width: '100%', height: '100%', minHeight: 300 }}
      value={sandpack.files[sandpack.activePath].code}
      onChange={(e) => {
        sandpack.updateCurrentFile(e.target.value);
      }}
    />
  );
}

function TranspiledCode(): JSX.Element | null {
  const { sandpack } = useSandpack();

  const code = sandpack.bundlerState?.transpiledModules[sandpack.activePath + ':']?.source?.compiledCode;
  if (!code) {
    return null;
  }

  return <textarea style={{ width: '100%', height: '100%', minHeight: 300 }} value={code} readOnly />;
}

export function SandpackPage(): any {
  return (
    <div>
      <SandpackProvider
        customSetup={{
          dependencies: {},
          files: {
            '/App.js': {
              code: APP_CODE,
            },
          },
        }}
        template="react"
      >
        <SandpackLayout>
          <Editor />
          <TranspiledCode />
          <SandpackPreview />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
