import Icon from '../Icon';

export default function Topbar({ onMenu }) {
  return (
    <header className="flex items-center gap-3 border-b border-cream-300 bg-white px-4 py-3 md:hidden">
      <button className="btn-ghost" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" />
      </button>
      <span className="font-semibold text-slate-700">reyOne</span>
    </header>
  );
}
