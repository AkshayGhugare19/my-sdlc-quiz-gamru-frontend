// Minimal inline SVG icon set — no external icon dependency.
// Each icon is a 24x24 stroke path. Usage: <Icon name="grid" className="w-5 h-5" />
const PATHS = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  book: 'M4 5a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2zM8 3v16',
  route: 'M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 13V9a4 4 0 0 1 4-4h5',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7M12 17h.01',
  badge: 'M12 2l2.5 2 3.5-.5.5 3.5 2 2.5-2 2.5-.5 3.5-3.5-.5L12 20l-2.5-2-3.5.5-.5-3.5-2-2.5 2-2.5.5-3.5 3.5.5z',
  crown: 'M3 7l4 4 5-6 5 6 4-4v10H3zM3 20h18',
  bars: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  hat: 'M12 4l9 4-9 4-9-4zM7 10v5c0 1 2.2 2 5 2s5-1 5-2v-5',
  ghost: 'M5 21V9a7 7 0 0 1 14 0v12l-2.5-2-2.5 2-2-2-2 2-2.5-2zM9.5 10h.01M14.5 10h.01',
  gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7C10 7 7 6 7 4.5S9 3 12 7zM12 7c2 0 5-1 5-2.5S15 3 12 7z',
  cart: 'M3 4h2l2.5 12h10l2-8H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  trophy: 'M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0zM6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3',
  rank: 'M4 20h4v-8H4zM10 20h4V4h-4zM16 20h4v-5h-4z',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h3l7 4V6L7 10H4a1 1 0 0 0-1 1zM18 8a4 4 0 0 1 0 8',
  bell: 'M18 9a6 6 0 1 0-12 0c0 6-3 7-3 7h18s-3-1-3-7M13.5 21a2 2 0 0 1-3 0',
  certificate: 'M4 4h16v12H4zM8 20l4-3 4 3M8 8h8M8 11h5',
  users: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.8',
  building: 'M3 21h18M6 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  close: 'M18 6 6 18M6 6l12 12',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  pin: 'M12 17v5M9 3h6l-1 6 3 3H7l3-3z',
  upload: 'M12 15V3M7 8l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  check: 'M20 6 9 17l-5-5',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
};

export default function Icon({ name, className = 'w-5 h-5', strokeWidth = 1.8 }) {
  const d = PATHS[name] || PATHS.grid;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {d.split('M').filter(Boolean).map((seg, i) => (
        <path key={i} d={`M${seg}`} />
      ))}
    </svg>
  );
}
