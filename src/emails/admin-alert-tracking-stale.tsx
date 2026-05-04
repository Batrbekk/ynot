import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface AdminAlertTrackingStaleProps {
  affectedCount: number;
  oldestStaleSinceHours: number;
  adminUrl: string;
}

export function AdminAlertTrackingStale(p: AdminAlertTrackingStaleProps) {
  return (
    <EmailLayout previewText={`Tracking sync stale (${p.affectedCount} orders)`}>
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        Tracking updates are falling behind.
      </Heading>
      <Text>
        {`${p.affectedCount} order${p.affectedCount === 1 ? "" : "s"} ${p.affectedCount === 1 ? "has" : "have"} not received a tracking update from the carrier in over ${p.oldestStaleSinceHours} hours.`}
      </Text>
      <Text>
        This usually means the carrier API is unavailable, the parcel hasn&apos;t been scanned, or
        the tracking number was rejected.
      </Text>

      <Section style={{ marginTop: 24 }}>
        <Button
          href={p.adminUrl}
          style={{
            background: "#111",
            color: "#fff",
            padding: "12px 24px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          View affected orders
        </Button>
      </Section>
    </EmailLayout>
  );
}
