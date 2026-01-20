import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface Ticket {
  id: string;
  created_at: string;
  status: string;
}

const COLORS = ['#82ca9d', '#FF8042']; // Green for resolved, Orange for unresolved

const ResolvedTicketsChart = () => {
  const { data: tickets, isLoading, error } = useQuery<Ticket[], Error>({
    queryKey: ['resolvedTicketsPercentage'],
    queryFn: async () => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const { data, error } = await supabase
        .from('tickets')
        .select('id, created_at, status')
        .gte('created_at', threeMonthsAgo.toISOString());

      if (error) throw new Error(error.message);
      return data;
    },
  });

  const processResolvedData = (tickets: Ticket[] | undefined) => {
    if (!tickets || tickets.length === 0) {
      return [
        { name: 'Diselesaikan', value: 0 },
        { name: 'Belum Diselesaikan', value: 0 },
      ];
    }

    const resolvedCount = tickets.filter((ticket) => ticket.status === 'resolved').length;
    const unresolvedCount = tickets.length - resolvedCount;

    return [
      { name: 'Diselesaikan', value: resolvedCount },
      { name: 'Belum Diselesaikan', value: unresolvedCount },
    ];
  };

  const data = processResolvedData(tickets);

  if (isLoading) {
    return (
      <Card className="h-[350px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-[350px] flex items-center justify-center">
        <p className="text-red-500">Gagal memuat data persentase tiket: {error.message}</p>
      </Card>
    );
  }

  return (
    <Card className="h-[350px]">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Persentase Tiket Diselesaikan (3 Bulan Terakhir)</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-80px)]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [`${value} tiket`, name]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ResolvedTicketsChart;