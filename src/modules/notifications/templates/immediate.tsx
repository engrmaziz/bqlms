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

export interface ImmediateEmailProps {
  collegeName: string;
  recipientName: string;
  title: string;
  body: string;
  actionUrl: string;
  categoryLabel: string;
}

export function ImmediateEmailTemplate({
  collegeName,
  recipientName,
  title,
  body,
  actionUrl,
  categoryLabel,
}: ImmediateEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${collegeName}: ${title}`}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          <Section style={headerSection}>
            <Text style={brandText}>{collegeName}</Text>
            <Text style={badgeText}>{categoryLabel}</Text>
          </Section>

          <Heading style={headingStyle}>{title}</Heading>

          <Text style={greetingStyle}>Hello {recipientName},</Text>
          <Text style={bodyStyle}>{body}</Text>

          <Section style={buttonContainer}>
            <Button style={buttonStyle} href={actionUrl}>
              View in College Portal
            </Button>
          </Section>

          <Hr style={hrStyle} />

          <Text style={footerStyle}>
            This is an automated notification from {collegeName}. You can adjust
            your notification preferences at any time in your account settings.
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
  maxWidth: "560px",
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
  marginBottom: "8px",
};

const bodyStyle = {
  fontSize: "14px",
  lineHeight: "1.5",
  color: "#3f3f46",
  marginBottom: "24px",
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
