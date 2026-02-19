import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Pencil, Trash2, UserPlus } from 'lucide-react';

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

// Form schema for editing user
const editUserFormSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email({ message: 'Invalid email address.' }),
});

type CreateUserFormValues = z.infer<typeof createUserFormSchema>;
type EditUserFormValues = z.infer<typeof editUserFormSchema>;

const ManageRoles = () => {
  const { session, loading, role, user: currentUser } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

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
      if (data.error) throw new Error(data.error);
      return data.users;
    },
    enabled: !!session && role === 'admin',
  });

  // Mutation for creating a new user
  const createUserMutation = useMutation<any, Error, CreateUserFormValues>({
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
      createUserForm.reset();
      setIsCreateUserDialogOpen(false);
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

  // Mutation for editing user details
  const editUserMutation = useMutation<any, Error, { userId: string; userData: EditUserFormValues }>({
    mutationFn: async ({ userId, userData }) => {
      const { data, error } = await supabase.functions.invoke(`admin-users?id=${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      showSuccess('User details updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      editUserForm.reset();
      setSelectedUser(null);
      setIsEditUserDialogOpen(false);
    },
    onError: (error) => {
      showError(`Failed to update user: ${error.message}`);
    },
  });

  // Mutation for deleting a user
  const deleteUserMutation = useMutation<any, Error, string>({
    mutationFn: async (userId) => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'delete', userId }),
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      showSuccess('User deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      showError(`Failed to delete user: ${error.message}`);
    },
  });

  const createUserForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'customer_service',
    },
  });

  const editUserForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
    },
  });

  const onSubmitCreateUser = (values: CreateUserFormValues) => {
    createUserMutation.mutate(values);
  };

  const onSubmitEditUser = (values: EditUserFormValues) => {
    if (selectedUser) {
      editUserMutation.mutate({ userId: selectedUser.id, userData: values });
    }
  };

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    updateUserRoleMutation.mutate({ userId, newRole });
  };

  const handleEditClick = (user: UserProfile) => {
    setSelectedUser(user);
    editUserForm.reset({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email,
    });
    setIsEditUserDialogOpen(true);
  };

  const handleDeleteClick = (user: UserProfile) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
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
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Create New User
            </Button>
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
                        <FormControl>
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
                <TableHead className="text-center">Actions</TableHead>
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
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEditClick(user)}
                        aria-label="Edit user"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteClick(user)}
                        disabled={currentUser?.id === user.id}
                        aria-label={currentUser?.id === user.id ? "Cannot delete yourself" : "Delete user"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the user's details below.
            </DialogDescription>
          </DialogHeader>
          <Form {...editUserForm}>
            <form onSubmit={editUserForm.handleSubmit(onSubmitEditUser)} className="space-y-4">
              <FormField
                control={editUserForm.control}
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
                control={editUserForm.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editUserForm.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditUserDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editUserMutation.isPending}>
                  {editUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedUser?.email}</strong>? This action cannot be undone.
              All data associated with this user will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUserMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ManageRoles;