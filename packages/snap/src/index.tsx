import type { OnHomePageHandler } from '@metamask/snaps-sdk';
import { Box, Heading, Text, Link, Divider, Button } from '@metamask/snaps-sdk/jsx';

export const onHomePage: OnHomePageHandler = async () => {
  const interfaceId = await snap.request({
    method: 'snap_createInterface',
    params: {
      ui: (
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
          <Divider />
          <Heading>Multichain Provider Test</Heading>
          <Text>
            Test whether eth_sendTransaction works via wallet_invokeMethod.
            This will attempt a 0-value self-transfer on the Intuition chain.
          </Text>
          <Button name="test_create_session">Step 1: Create Session</Button>
          <Button name="test_send_tx">Step 2: Send Transaction</Button>
        </Box>
      ),
    },
  });
  console.log('KYLAN | interfaceId', interfaceId);
  return { id: interfaceId };
};

export * from './onTransaction';
export * from './onUserInput';
