import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAdmin, listAdmins, listRoles, updateAdmin } from '../../api/admin.api';
import { Card } from '../../components/Card';
import { ApiError } from '../../api/client';
import { Role } from '../../types/api';

function CreateAdminForm({ roles }: { roles: Role[] }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [roleName, setRoleName] = useState<Role>(roles[0] ?? 'viewer');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createAdmin({ email, fullName, password, roleName }),
    onSuccess: () => {
      setEmail('');
      setFullName('');
      setPassword('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create admin'),
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
      <select
        value={roleName}
        onChange={(e) => setRoleName(e.target.value as Role)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
      >
        {roles.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {mutation.isPending ? 'Creating…' : 'Add admin user'}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}

export function AdminUsersPage() {
  const adminsQuery = useQuery({ queryKey: ['admins'], queryFn: listAdmins });
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const queryClient = useQueryClient();

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'disabled' }) => updateAdmin(id, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admins'] }),
  });

  const roles = (rolesQuery.data ?? []).map((r) => r.name);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Admin Users</h1>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Add admin user</h2>
        {roles.length > 0 && <CreateAdminForm roles={roles} />}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Dashboard users</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-gray-400">
            <tr>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {adminsQuery.data?.map((admin) => (
              <tr key={admin.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-2 pr-4">{admin.fullName}</td>
                <td className="py-2 pr-4 text-gray-500">{admin.email}</td>
                <td className="py-2 pr-4 uppercase text-xs text-gray-500">{admin.roleName}</td>
                <td className="py-2 pr-4">{admin.status}</td>
                <td className="py-2">
                  <button
                    onClick={() =>
                      toggleStatus.mutate({ id: admin.id, status: admin.status === 'active' ? 'disabled' : 'active' })
                    }
                    className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {admin.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
