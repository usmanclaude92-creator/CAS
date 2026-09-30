/** Same purpose as toolActivityLabels.ts, kept separate for the ACTION tool
 *  class — never the internal tool name, never implementation detail. */
const ACTION_LABELS: Record<string, string> = {
  create_reminder: 'Creating a reminder…',
  update_vendor_contact_info: 'Preparing a vendor update…',
  create_direct_expense: 'Preparing to post an expense…',
};

export function actionToolActivityLabel(toolName: string): string {
  return ACTION_LABELS[toolName] ?? 'Preparing an action…';
}
