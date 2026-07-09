import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getLiveEmployees } from '../../api/dashboard.api';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';

const POLL_INTERVAL_MS = 15_000;

export function LiveEmployeesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'live'],
    queryFn: getLiveEmployees,
    refetchInterval: POLL_INTERVAL_MS,
  });

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Live Employees</h1>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Failed to load live employees.</p>}

      {data && data.length === 0 && (
        <Card>
          <p className="text-sm text-gray-500">No active sessions right now.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((employee) => (
          <Link key={employee.employeeId} to={`/employees/${employee.employeeId}`}>
            <Card className="transition-shadow hover:shadow-md">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{employee.employeeFullName}</span>
                <StatusBadge status={employee.status} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{employee.hostname}</p>
              <p className="mt-2 text-xs text-gray-400">
                Last heartbeat: {new Date(employee.lastHeartbeatAt).toLocaleTimeString()}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
