import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listEmployees } from '../../api/employees.api';
import { getEmployeeSummary } from '../../api/dashboard.api';
import { Card } from '../../components/Card';

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function ReportsPage() {
  const employeesQuery = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => listEmployees({ page: 1, pageSize: 200 }),
  });

  const employees = employeesQuery.data?.items ?? [];

  const summaryQueries = useQueries({
    queries: employees.map((employee) => ({
      queryKey: ['employee-summary', employee.id],
      queryFn: () => getEmployeeSummary(employee.id),
      enabled: employees.length > 0,
    })),
  });

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Reports — Today</h1>
      <Card>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-gray-400">
            <tr>
              <th className="py-2 pr-4">Employee</th>
              <th className="py-2 pr-4">Team</th>
              <th className="py-2 pr-4">Active</th>
              <th className="py-2 pr-4">Idle</th>
              <th className="py-2">Screenshots</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, index) => {
              const summary = summaryQueries[index]?.data;
              return (
                <tr key={employee.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4">
                    <Link to={`/employees/${employee.id}`} className="text-indigo-600 hover:underline dark:text-indigo-400">
                      {employee.fullName}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{employee.team ?? '—'}</td>
                  <td className="py-2 pr-4">{summary ? formatDuration(summary.activeSeconds) : '…'}</td>
                  <td className="py-2 pr-4">{summary ? formatDuration(summary.idleSeconds) : '…'}</td>
                  <td className="py-2">{summary?.screenshotCount ?? '…'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {employees.length === 0 && !employeesQuery.isLoading && (
          <p className="text-sm text-gray-500">No employees yet.</p>
        )}
      </Card>
    </div>
  );
}
