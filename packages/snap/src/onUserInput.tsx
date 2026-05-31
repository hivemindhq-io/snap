/**
 * `onUserInput` handler for the interactive transaction-insight panel.
 *
 * Drives navigation between the primary insight and the secondary "More info"
 * page. The full {@link InsightModel} rides along in the interface context, so
 * we re-render the requested view from in-memory state without re-fetching any
 * data (the context is preserved across updates).
 *
 * @module onUserInput
 */

import type { OnUserInputHandler } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';

import {
  MORE_INFO_BUTTON,
  BACK_BUTTON,
  buildPrimaryInsight,
  buildMoreInfoInsight,
  modelFromContext,
  toInterfaceContext,
} from './insight-view';

export const onUserInput: OnUserInputHandler = async ({
  id,
  event,
  context,
}) => {
  if (event.type !== UserInputEventType.ButtonClickEvent) {
    return;
  }

  const model = modelFromContext(context);
  if (!model) {
    return;
  }

  let ui;
  if (event.name === MORE_INFO_BUTTON) {
    ui = buildMoreInfoInsight(model);
  } else if (event.name === BACK_BUTTON) {
    ui = buildPrimaryInsight(model);
  } else {
    return;
  }

  // Preserve the context so subsequent navigation still has the model. The
  // `context` param is supported by the MetaMask client (and by newer
  // @metamask/snaps-sdk types), but the `snap` global's request typing here
  // resolves to an older SDK copy whose `snap_updateInterface` params omit
  // `context`. Cast the params at this boundary so the model survives
  // navigation; the runtime behavior is unaffected.
  await snap.request({
    method: 'snap_updateInterface',
    params: { id, ui, context: toInterfaceContext(model) } as never,
  });
};
