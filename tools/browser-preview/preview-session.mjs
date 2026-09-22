import { P0TenPunchSession } from '../../.preview-dist/app/session/P0TenPunchSession.js';

export class PreviewTenPunchSession extends P0TenPunchSession {
  constructor(clock, motionSourceIds, options) {
    super(clock, motionSourceIds, {...options, ruleset:'candidate'});
  }
}
