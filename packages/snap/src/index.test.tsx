/**
 * Main entry point tests for the Hive Mind Snap.
 *
 * This file contains tests for the snap's exported handlers:
 * - onHomePage: Renders the snap's home page (tested below)
 * - onTransaction: Requires network access - test manually in MetaMask Flask
 *
 * Note: onTransaction integration tests are not included because the
 * @metamask/snaps-jest framework runs the Snap in an isolated worker
 * where network requests cannot be mocked from the test process.
 * For full E2E testing, use MetaMask Flask with a local development server.
 */

import { expect, describe, it } from '@jest/globals';
import { installSnap } from '@metamask/snaps-jest';

describe('Snap Handlers', () => {
  describe('onHomePage', () => {
    it('should render the home page with welcome content', async () => {
      const snap = await installSnap();

      const response = await snap.onHomePage();

      // Home page should return a valid interface
      const ui = response.getInterface();
      expect(ui).toBeDefined();
      expect(ui.content).toBeDefined();

      // Verify the content structure
      const content = ui.content as { type: string; props: any };
      expect(content.type).toBe('Box');

      // Check for welcome text
      const rendered = JSON.stringify(ui.content);
      expect(rendered).toContain('Hive Mind');
      expect(rendered).toContain('trust');
    });

    it('should include a link to Hive Mind and Intuition', async () => {
      const snap = await installSnap();

      const response = await snap.onHomePage();
      const ui = response.getInterface();
      const rendered = JSON.stringify(ui.content);

      expect(rendered).toContain('hivemindhq.io');
      expect(rendered).toContain('intuition.systems');
      expect(rendered).toContain('Link');
    });
  });
});
