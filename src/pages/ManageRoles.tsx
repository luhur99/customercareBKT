import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';

// Define user role enum for client-side validation and display
const USER_ROLES = ['admin', 'customer_service', 'sales'] as const;
type UserRole = typeof USER_ROLES[number];

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  created_at: string;
}

// Form schema for creating a new user
const createUserFormSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: z.enum(USER_ROLES, { message: 'Please select a valid role.' }),
});

const ManageRoles = () => {
  const { session, loading, role } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!session || role !== 'admin')) {
      showError('You do not have permission to access this page.');
      navigate('/');
    }
  }, [session, loading, role, navigate]);

  // Fetch all users
  const { data: users, isLoading: isLoadingUsers, error: usersError } = useQuery<UserProfile[], Error>({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error); // Handle errors from the edge function itself
      return data.users;
    },
    enabled: !!session && role === 'admin', // Only fetch if logged in and is admin
  });

  // Mutation for creating a new user
  const createUserMutation = useMutation<any, Error, z.infer<typeof createUserFormSchema>>({
    mutationFn: async (newUser) => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      showSuccess('User created successfully!');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setIsCreateUserDialogOpen(false);
      createUserForm.reset();
    },
    onError: (error) => {
      showError(`Failed to create user: ${error.message}`);
    },
  });

  // Mutation for updating user role
  const updateUserRoleMutation = useMutation<any, Error, { userId: string; newRole: UserRole }>({
    mutationFn: async ({ userId, newRole }) => {
      const { data, error } = await supabase.functions.invoke(`admin-users?id=${userId}&role=${newRole}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      showSuccess('User role updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (error) => {
      showError(`Failed to update role: ${error.message}`);
    },
  });

  const createUserForm = useForm<z.infer<typeof createUserFormSchema>>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'customer_service', // Default role for new users changed to 'customer_service'
    },
  });

  const onSubmitCreateUser = (values: z.infer<typeof createUserFormSchema>) => {
    createUserMutation.mutate(values);
  };

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    updateUserRoleMutation.mutate({ userId, newRole });
  };

  if (loading || (session && role !== 'admin')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <p className="text-gray-700 dark:text-gray-300">
          {loading ? 'Loading...' : 'Redirecting...'}
        </p>
      </div>
    );
  }

  if (usersError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Failed to load users: {usersError.message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Manage User Roles</h1>

      <div className="flex justify-end mb-4">
        <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create New User</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Fill in the details to create a new user account.
              </DialogDescription>
            </DialogHeader>
            <Form {...createUserForm}>
              <form onSubmit={createUserForm.handleSubmit(onSubmitCreateUser)} className="space-y-4">
                <FormField
                  control={createUserForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="user@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createUserForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createUserForm.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createUserForm.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl> {/* Corrected placement */}
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {USER_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create User
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoadingUsers ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-gray-600 dark:text-gray-400">Loading users...</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>First Name</TableHead>
                <TableHead>Last Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.first_name || '-'}</TableCell>
                  <TableCell>{user.last_name || '-'}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(newRole: UserRole) => handleRoleChange(user.id, newRole)}
                      disabled={updateUserRoleMutation.isPending}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                          {USER_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ManageRoles;