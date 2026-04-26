import * as React from "react";

export interface ShippingRow {
  destination: string;
  time: string;
  carrier: string;
  cost: string;
}

export function ShippingTable({ rows }: { rows: ShippingRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-t border-border-light text-left">
        <thead>
          <tr className="border-b border-border-light text-[11px] uppercase tracking-[0.2em] text-foreground-secondary">
            <th className="py-4 pr-4 font-medium">Destination</th>
            <th className="py-4 pr-4 font-medium">Delivery time</th>
            <th className="py-4 pr-4 font-medium">Carrier</th>
            <th className="py-4 font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.destination} className="border-b border-border-light text-[14px]">
              <td className="py-4 pr-4">{r.destination}</td>
              <td className="py-4 pr-4">{r.time}</td>
              <td className="py-4 pr-4">{r.carrier}</td>
              <td className="py-4">{r.cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
