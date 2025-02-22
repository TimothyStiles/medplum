import { assertOk, badRequest } from '@medplum/core';
import { OperationOutcome, User } from '@medplum/fhirtypes';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { pwnedPassword } from 'hibp';
import { invalidRequest, sendOutcome, systemRepo } from '../fhir';
import { authenticateToken } from '../oauth';

export const changePasswordValidators = [
  body('oldPassword').notEmpty().withMessage('Missing oldPassword'),
  body('newPassword').isLength({ min: 8 }).withMessage('Invalid password, must be at least 8 characters'),
];

export async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  return authenticateToken(req, res, async () => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendOutcome(res, invalidRequest(errors));
      return;
    }

    const [userOutcome, user] = await systemRepo.readResource<User>('User', res.locals.user);
    assertOk(userOutcome, user);

    const outcome = await changePassword({
      user,
      oldPassword: req.body.oldPassword,
      newPassword: req.body.newPassword,
    });

    sendOutcome(res, outcome);
  });
}

export interface ChangePasswordRequest {
  user: User;
  oldPassword: string;
  newPassword: string;
}

export async function changePassword(request: ChangePasswordRequest): Promise<OperationOutcome> {
  const oldPasswordHash = request.user.passwordHash as string;
  const bcryptResult = await bcrypt.compare(request.oldPassword, oldPasswordHash);
  if (!bcryptResult) {
    return badRequest('Incorrect password', 'oldPassword');
  }

  const numPwns = await pwnedPassword(request.newPassword);
  if (numPwns > 0) {
    return badRequest('Password found in breach database', 'newPassword');
  }

  const newPasswordHash = await bcrypt.hash(request.newPassword, 10);
  const [outcome] = await systemRepo.updateResource<User>({
    ...request.user,
    passwordHash: newPasswordHash,
  });

  return outcome;
}
