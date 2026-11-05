/** An explicit, accessible confirmation for irreversible /clear commands. */
export interface ClearConfirmationDependencies {
  onOpen: () => void;
  onClose: () => void;
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error('Missing clear command UI #' + id);
  return element as T;
}

export function createClearConfirmation(deps: ClearConfirmationDependencies) {
  const dialog = requiredElement<HTMLDialogElement>('clearConfirm');
  const message = requiredElement<HTMLElement>('clearConfirmMessage');
  const cancel = requiredElement<HTMLButtonElement>('clearCancel');
  const accept = requiredElement<HTMLButtonElement>('clearAccept');

  let onConfirm: (() => void) | null = null;
  let active = false;
  function dismiss(): void {
    if (dialog.open) dialog.close();
  }

  cancel.addEventListener('click', dismiss);
  accept.addEventListener('click', () => {
    const confirm = onConfirm;
    if (!confirm) return;
    onConfirm = null;
    dismiss();
    confirm();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dismiss();
  });
  // Escape should dismiss this dialog, not trigger the global inventory/menu handlers.
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    }
  });
  dialog.addEventListener('close', () => {
    if (!active) return;
    active = false;
    onConfirm = null;
    deps.onClose();
  });

  function open(count: number, confirm: () => void): void {
    if (active) return;
    message.textContent =
      'Permanently delete ' +
      count +
      ' item' +
      (count === 1 ? '' : 's') +
      ' from your backpack? This cannot be undone.';
    onConfirm = confirm;
    active = true;
    dialog.showModal();
    deps.onOpen();
    cancel.focus();
  }

  return { open };
}
