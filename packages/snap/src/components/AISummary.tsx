import { Box, Text, Heading, Section, Divider, Bold, Button } from '@metamask/snaps-sdk/jsx';

/**
 * Loading state displayed while the AI summary is being generated.
 *
 * @param props.label - The entity being summarized (address, domain, etc.)
 */
export const AISummaryLoading = ({ label }: { label: string }) => (
  <Box>
    <Section>
      <Heading>AI Summary</Heading>
      <Text>
        Generating summary for <Bold>{label}</Bold>...
      </Text>
      <Text>Hang tight — this can take up to 30 seconds.</Text>
    </Section>
  </Box>
);

/**
 * Displays the AI-generated summary with a Back button to return
 * to the original transaction insight view.
 *
 * @param props.summary - The AI-generated summary text
 * @param props.label - The entity that was summarized
 */
export const AISummaryView = ({
  summary,
  label,
}: {
  summary: string;
  label: string;
}) => (
  <Box>
    <Section>
      <Heading>AI Summary</Heading>
      <Text>
        <Bold>{label}</Bold>
      </Text>
    </Section>
    <Divider />
    <Section>
      <Text>{summary}</Text>
    </Section>
    <Divider />
    <Box>
      <Button name="back">Back to Transaction Insight</Button>
    </Box>
  </Box>
);

/**
 * Error state displayed when the AI summary request fails.
 * Includes a Back button so the user can return to the original view.
 *
 * @param props.error - The error message to display
 */
export const AISummaryError = ({ error }: { error: string }) => (
  <Box>
    <Section>
      <Heading>AI Summary</Heading>
      <Text>Unable to generate summary: {error}</Text>
    </Section>
    <Divider />
    <Box>
      <Button name="back">Back to Transaction Insight</Button>
    </Box>
  </Box>
);
