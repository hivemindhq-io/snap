import type { OnHomePageHandler } from '@metamask/snaps-sdk';
import { Box, Heading, Text, Link, Divider } from '@metamask/snaps-sdk/jsx';

export const onHomePage: OnHomePageHandler = async () => {
  return {
    content: (
      <Box>
        <Heading>Welcome to Hive Mind, powered by Intuition</Heading>
        <Text>
          Real-time trust and sentiment insights for every transaction.
        </Text>
        <Divider />
        <Text>
          Hive Mind shows you community trust data from the Intuition knowledge
          graph during transactions.
        </Text>
        <Box>
          <Link href="https://hivemindhq.io">Check out Hive Mind's product suite</Link>
          <Link href="https://intuition.systems">Learn about Intuition</Link>
        </Box>
      </Box>
    ),
  };
};

export * from './onTransaction';
export * from './onUserInput';
