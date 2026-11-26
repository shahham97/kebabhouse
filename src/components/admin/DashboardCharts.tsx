'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { formatAUD } from '@/lib/money';

const PALETTE = ['#C8401E', '#F4A62A', '#2F7D4A', '#1C1412'];

interface DashboardChartsProps {
  revenueByPaymentMethod: Array<{ method: string; amountCents: number; count: number }>;
  ordersByFulfilment: Array<{ fulfilment: string; count: number }>;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD_EFTPOS: 'EFTPOS',
  CARD_ONLINE: 'Online Card',
  OTHER: 'Other',
};

const FULFILMENT_LABELS: Record<string, string> = {
  DINE_IN: 'Dine-in',
  PICKUP: 'Pickup',
  DELIVERY: 'Delivery',
};

export function DashboardCharts({
  revenueByPaymentMethod,
  ordersByFulfilment,
}: DashboardChartsProps) {
  const barData = revenueByPaymentMethod.map((r) => ({
    name: METHOD_LABELS[r.method] ?? r.method,
    amountDollars: Number((r.amountCents / 100).toFixed(2)),
    amountCents: r.amountCents,
    count: r.count,
  }));

  const pieData = ordersByFulfilment.map((r) => ({
    name: FULFILMENT_LABELS[r.fulfilment] ?? r.fulfilment,
    value: r.count,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Revenue by Payment Method */}
      <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-char">
              Revenue by Payment Method
            </h2>
            <p className="text-xs text-smoke">Succeeded payments (AUD)</p>
          </div>
        </div>
        {barData.length === 0 ? (
          <div className="flex h-60 items-center justify-center text-sm text-smoke">
            No payment data recorded yet.
          </div>
        ) : (
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fill: '#6B5E55', fontSize: 12 }} />
                <YAxis
                  tick={{ fill: '#6B5E55', fontSize: 12 }}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  formatter={(value: unknown) => {
                    const num = typeof value === 'number' ? value : Number(value ?? 0);
                    return [formatAUD(Math.round(num * 100)), 'Revenue'];
                  }}
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#E5D5C0',
                    backgroundColor: '#FFF7EC',
                    color: '#1C1412',
                  }}
                />
                <Bar dataKey="amountDollars" radius={[8, 8, 0, 0]}>
                  {barData.map((_, idx) => (
                    <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Orders by Fulfilment Type */}
      <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-char">
              Orders by Fulfilment Type
            </h2>
            <p className="text-xs text-smoke">Dine-in vs Pickup vs Delivery split</p>
          </div>
        </div>
        {pieData.length === 0 ? (
          <div className="flex h-60 items-center justify-center text-sm text-smoke">
            No orders recorded yet.
          </div>
        ) : (
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={86}
                  paddingAngle={3}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#E5D5C0',
                    backgroundColor: '#FFF7EC',
                    color: '#1C1412',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
