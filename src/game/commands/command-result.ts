/** Deferred irreversible command action; the console owns its confirmation UI. */
export interface ClearConfirmationRequest {
  kind: 'confirm-clear';
  count: number;
  confirm: () => string;
}

export type CommandResult = string | void | ClearConfirmationRequest;
