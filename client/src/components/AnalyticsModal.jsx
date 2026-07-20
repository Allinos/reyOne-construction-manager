import Modal from './Modal';
import Icon from './Icon';

// Reusable "Analytics" button + popup used across Finance, Expenses, Projects.
export function AnalyticsButton({ onClick }) {
  return (
    <button className="btn-primary" onClick={onClick}>
      <Icon name="chart" className="h-4 w-4" />
      Analytics
    </button>
  );
}

export default function AnalyticsModal({ open, onClose, title, children }) {
  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="space-y-6">{children}</div>
    </Modal>
  );
}
