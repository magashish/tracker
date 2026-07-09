import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getEmployeeSummary, getEmployeeTimeline } from '../../api/dashboard.api';
import { Card } from '../../components/Card';

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function EmployeeProfilePage() {
  const { employeeId = '' } = useParams();

  const summaryQuery = useQuery({
    queryKey: ['employee-summary', employeeId],
    queryFn: () => getEmployeeSummary(employeeId),
    enabled: !!employeeId,
  });

  const timelineQuery = useQuery({
    queryKey: ['employee-timeline', employeeId],
    queryFn: () => getEmployeeTimeline(employeeId),
    enabled: !!employeeId,
  });

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Employee Profile</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase text-gray-400">Active time today</p>
          <p className="mt-1 text-xl font-semibold">{summary ? formatDuration(summary.activeSeconds) : '—'}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-gray-400">Idle time today</p>
          <p className="mt-1 text-xl font-semibold">{summary ? formatDuration(summary.idleSeconds) : '—'}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-gray-400">Screenshots today</p>
          <p className="mt-1 text-xl font-semibold">{summary?.screenshotCount ?? '—'}</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Screenshots</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {timelineQuery.data?.screenshots.map((shot) => (
            <div key={shot.id} className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-800">
              {shot.viewUrl ? (
                <img src={shot.viewUrl} alt={shot.appName ?? 'Screenshot'} className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-gray-100 text-xs text-gray-400 dark:bg-gray-800">
                  No preview
                </div>
              )}
              <div className="p-2 text-xs text-gray-500">
                {new Date(shot.capturedAt).toLocaleTimeString()} · {shot.appName ?? 'Unknown app'}
              </div>
            </div>
          ))}
          {timelineQuery.data && timelineQuery.data.screenshots.length === 0 && (
            <p className="col-span-full text-sm text-gray-500">No screenshots for today yet.</p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Activity Timeline</h2>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-400">
              <tr>
                <th className="py-1 pr-4">Time</th>
                <th className="py-1 pr-4">Application</th>
                <th className="py-1 pr-4">Window</th>
                <th className="py-1">Active / Idle</th>
              </tr>
            </thead>
            <tbody>
              {timelineQuery.data?.activity.map((sample) => (
                <tr key={sample.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-1.5 pr-4 text-gray-500">{new Date(sample.windowStart).toLocaleTimeString()}</td>
                  <td className="py-1.5 pr-4">{sample.appName}</td>
                  <td className="max-w-xs truncate py-1.5 pr-4 text-gray-500">{sample.windowTitle}</td>
                  <td className="py-1.5">
                    {sample.activeSeconds}s / {sample.idleSeconds}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {timelineQuery.data && timelineQuery.data.activity.length === 0 && (
            <p className="text-sm text-gray-500">No activity recorded for today yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
