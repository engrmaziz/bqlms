import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface DigestItem {
  title: string;
  body: string;
  categoryLabel: string;
  link?: string | null;
}

export interface DigestEmailProps {
  collegeName: string;
  recipientName: string;
  items: DigestItem[];
  portalUrl: string;
}

export function DigestEmailTemplate({
  collegeName,
  recipientName,
  items,
  portalUrl,
}: DigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${collegeName} Daily Digest: ${items.length} updates for you`}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          <Section style={headerSection}>
            <Text style={brandText}>{collegeName}</Text>
            <Text style={badgeText}>Daily Summary</Text>
          </Section>

          <Heading style={headingStyle}>Your Daily Academic Digest</Heading>

          <Text style={greetingStyle}>
            Hello {recipientName}, here is your summary of {items.length} unread
            update{items.length === 1 ? "" : "s"} across your courses and campus
            activities:
          </Text>

          <Section style={itemsContainer}>
            {items.map((item, idx) => (
              <div
                key={`${item.title}-${item.categoryLabel}-${idx}`}
                style={itemStyle}
              >
                <div style={itemHeader}>
                  <Text style={itemCategory}>{item.categoryLabel}</Text>
                </div>
                <Text style={itemTitle}>{item.title}</Text>
                <Text style={itemBody}>{item.body}</Text>
                {item.link && (
                  <Button style={itemLinkButton} href={item.link}>
                    View details &rarr;
                  </Button>
                )}
                {idx < items.length - 1 && <Hr style={itemDivider} />}
              </div>
            ))}
          </Section>

          <Section style={buttonContainer}>
            <Button style={buttonStyle} href={portalUrl}>
              Go to Notifications Center
            </Button>
          </Section>

          <Hr style={hrStyle} />

          <Text style={footerStyle}>
            You received this digest according to your notification preferences.
            Manage notification frequency and digest timing in your settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const mainStyle = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: "0 auto",
  padding: "24px 0",
};

const containerStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e4e4e7",
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "580px",
  padding: "32px",
};

const headerSection = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "16px",
};

const brandText = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#4f46e5",
  margin: "0",
  letterSpacing: "-0.01em",
};

const badgeText = {
  fontSize: "11px",
  fontWeight: "600",
  color: "#71717a",
  backgroundColor: "#f4f4f5",
  padding: "4px 8px",
  borderRadius: "6px",
  margin: "0",
  textTransform: "uppercase" as const,
};

const headingStyle = {
  fontSize: "20px",
  fontWeight: "700",
  color: "#18181b",
  marginTop: "12px",
  marginBottom: "16px",
  lineHeight: "1.3",
};

const greetingStyle = {
  fontSize: "14px",
  fontWeight: "500",
  color: "#27272a",
  marginBottom: "16px",
  lineHeight: "1.5",
};

const itemsContainer = {
  marginBottom: "24px",
};

const itemStyle = {
  marginBottom: "12px",
};

const itemHeader = {
  marginBottom: "4px",
};

const itemCategory = {
  fontSize: "11px",
  fontWeight: "600",
  color: "#4f46e5",
  margin: "0",
  textTransform: "uppercase" as const,
};

const itemTitle = {
  fontSize: "15px",
  fontWeight: "600",
  color: "#18181b",
  margin: "4px 0",
};

const itemBody = {
  fontSize: "13px",
  lineHeight: "1.4",
  color: "#52525b",
  margin: "0 0 8px",
};

const itemLinkButton = {
  fontSize: "12px",
  fontWeight: "600",
  color: "#4f46e5",
  textDecoration: "none",
};

const itemDivider = {
  borderColor: "#f4f4f5",
  margin: "16px 0",
};

const buttonContainer = {
  textAlign: "center" as const,
  marginBottom: "24px",
};

const buttonStyle = {
  backgroundColor: "#4f46e5",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const hrStyle = {
  borderColor: "#f4f4f5",
  margin: "24px 0 16px",
};

const footerStyle = {
  fontSize: "11px",
  lineHeight: "1.4",
  color: "#71717a",
  margin: "0",
};
