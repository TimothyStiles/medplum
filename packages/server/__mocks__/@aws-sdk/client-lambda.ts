export class CreateFunctionCommand {
  constructor(public readonly input: any) {}
}

export class GetFunctionCommand {
  constructor(public readonly input: any) {}
}

export class UpdateFunctionCodeCommand {
  constructor(public readonly input: any) {}
}

export class InvokeCommand {
  constructor(public readonly input: any) {}
}

export class LambdaClient {
  static created = false;
  static updated = false;

  async send(command: any): Promise<any> {
    if (command instanceof GetFunctionCommand) {
      if (LambdaClient.created) {
        return {
          Configuration: {
            FunctionName: command.input.FunctionName,
          },
        };
      } else {
        return Promise.reject('Function not found');
      }
    }

    if (command instanceof CreateFunctionCommand) {
      LambdaClient.created = true;
      return {
        FunctionName: command.input.FunctionName,
      };
    }

    if (command instanceof UpdateFunctionCodeCommand) {
      LambdaClient.updated = true;
      return {
        FunctionName: command.input.FunctionName,
      };
    }

    if (command instanceof InvokeCommand) {
      return {
        LogResult: 'OK',
      };
    }

    return undefined;
  }
}
