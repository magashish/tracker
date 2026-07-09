export function StatusBadge({ status }: { status: 'online' | 'offline' }) {
  const isOnline = status === 'online';
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        isOnline
          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
      ].join(' ')}
    >
      <span className={['h-1.5 w-1.5 rounded-full', isOnline ? 'bg-green-500' : 'bg-gray-400'].join(' ')} />
      {isOnline ? 'Online' : 'Offline'}
    </span>
  );
}
