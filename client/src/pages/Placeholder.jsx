import { PageHeader, EmptyState } from '../components/ui';

// Temporary page for modules whose UI is built in a later step. The route,
// nav entry, and permission gating are already wired — only the screen is a stub.
export default function Placeholder({ title, note }) {
  return (
    <div>
      <PageHeader title={title} subtitle="This module's screens are coming in the next step." />
      <EmptyState title={`${title} UI coming soon`} hint={note || 'The backend API for this module is already live.'} />
    </div>
  );
}
