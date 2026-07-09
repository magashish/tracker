import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getGlobalConfig, updateGlobalConfig } from '../../api/admin.api';
import { createEmployee, listEmployees } from '../../api/employees.api';
import { Card } from '../../components/Card';
import { EffectiveConfig } from '../../types/api';
import { ApiError } from '../../api/client';

function ConfigForm() {
  const queryClient = useQueryClient();
  const configQuery = useQuery({ queryKey: ['config', 'global'], queryFn: getGlobalConfig });
  const [form, setForm] = useState<EffectiveConfig | null>(null);

  useEffect(() => {
    if (configQuery.data) setForm(configQuery.data);
  }, [configQuery.data]);

  const mutation = useMutation({
    mutationFn: (config: Partial<EffectiveConfig>) => updateGlobalConfig(config),
    onSuccess: (updated) => {
      queryClient.setQueryData(['config', 'global'], updated);
    },
  });

  if (!form) return <p className="text-sm text-gray-500">Loading…</p>;

  const field = (key: keyof EffectiveConfig, label: string, unit: string) => (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={form[key] as number}
          onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
          className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
        />
        <span className="text-sm text-gray-400">{unit}</span>
      </div>
    </div>
  );

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
      className="space-y-4"
    >
      {field('heartbeatIntervalSeconds', 'Heartbeat interval', 'seconds')}
      {field('screenshotIntervalSeconds', 'Screenshot interval', 'seconds')}
      {field('screenshotQuality', 'Screenshot JPEG quality', '1-100')}
      {field('idleThresholdSeconds', 'Idle threshold', 'seconds')}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">API URL</label>
        <input
          type="text"
          value={form.apiUrl}
          onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
          className="w-80 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
        />
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {mutation.isPending ? 'Saving…' : 'Save default configuration'}
      </button>
      {mutation.isSuccess && <p className="text-sm text-green-600">Saved.</p>}
    </form>
  );
}

function AddEmployeeForm() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [team, setTeam] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createEmployee({ email, fullName, password, team: team || undefined }),
    onSuccess: () => {
      setEmail('');
      setFullName('');
      setPassword('');
      setTeam('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create employee'),
  });

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <input
        placeholder="Full name"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
      />
      <input
        placeholder="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
      />
      <input
        placeholder="Temporary password"
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
      />
      <input
        placeholder="Team (optional)"
        value={team}
        onChange={(e) => setTeam(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
      />
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {mutation.isPending ? 'Creating…' : 'Add employee'}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {mutation.isSuccess && <p className="mt-2 text-sm text-green-600">Employee created.</p>}
      </div>
    </form>
  );
}

function EmployeeList() {
  const { data } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => listEmployees({ page: 1, pageSize: 200 }) });
  return (
    <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
      {data?.items.map((employee) => (
        <li key={employee.id} className="flex items-center justify-between py-2">
          <span>
            {employee.fullName} <span className="text-gray-400">({employee.email})</span>
          </span>
          <span className="text-xs uppercase text-gray-400">{employee.status}</span>
        </li>
      ))}
    </ul>
  );
}

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Settings</h1>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Default tracking configuration</h2>
        <ConfigForm />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Add employee</h2>
        <AddEmployeeForm />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Employees</h2>
        <EmployeeList />
      </Card>
    </div>
  );
}
