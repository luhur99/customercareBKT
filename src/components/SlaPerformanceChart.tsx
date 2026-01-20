import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { getSlaStatus } from '@/utils/sla';

interface Ticket {
  id: string;
  created_at: string;
  resolved_at: string | null;
  status: string;
}

interface SlaData {
  month: string;
  green: number;
  yellow: number;
  red: number;
}

const SlaPerformanceChart = () => {
  const { data: tickets, isLoading, error } = useQuery<Ticket[], Error>({
    queryKey: ['slaTickets'],
    queryFn: async () => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const { data, error } = await supabase
        .from('tickets')
        .select('id, created_at, resolved_at, status')
        .gte('created_at', threeMonthsAgo.toISOString());

      if (error) throw new Error(error.message);
      return data;
    },
  });

  const processSlaData = (tickets: Ticket[] | undefined): SlaData[] => {
    if (!tickets) return [];

    const monthlyData: { [key: string]: { green: number; yellow: number; red: number } } = {};
    const now = new Date();

    // Initialize data for the last 3 months
    for (let i = 0; i < 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
      monthlyData[monthKey] = { green: 0, yellow: 0, red: 0 };
    }

    tickets.forEach((ticket) => {
      const createdAt = new Date(ticket.created_at);
      const monthKey = createdAt.toLocaleString('id-ID', { month: 'short', year: 'numeric' });

      if (monthlyData[monthKey]) {
        const slaStatus = getSlaStatus(ticket.created_at, ticket.resolved_at, ticket.status);
        if (slaStatus === 'green') {
          monthlyData[monthKey].green++;
        } else if (slaStatus === 'yellow') {
          monthlyData[monthKey].yellow++;
        } else if (slaStatus === 'red') {
          monthlyData[monthKey].red++;
        }
      }
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });

    return sortedMonths.map((month) => ({
      month,
      ...monthlyData[month],
    }));
  };

  const data = processSlaData(tickets);

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
        <p className="text-red-500">Gagal memuat data SLA: {error.message}</p>
      </Card>
    );
  }

  return (
    <Card className="h-[350px]">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Kinerja SLA 3 Bulan Terakhir</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-80px)]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="green" stackId="a" fill="#82ca9d" name="Sesuai SLA" />
            <Bar dataKey="yellow" stackId="a" fill="#ffc658" name="Mendekati SLA" />
            <Bar dataKey="red" stackId="a" fill="#ff7300" name="Lewat SLA" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SlaPerformanceChart;