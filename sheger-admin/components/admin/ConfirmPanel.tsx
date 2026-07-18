type ConfirmPanelProps = {
  title: string;
  message: string;
  pending?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmPanel({
  title,
  message,
  pending = false,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmPanelProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
      <p className="text-sm font-semibold text-amber-900">{title}</p>
      <p className="mt-1 text-sm text-amber-800">{message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
