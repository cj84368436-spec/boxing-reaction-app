import {getSchemeUri} from '@apps-in-toss/framework';
import type {PlayRuntime} from './playRuntime';
import {readEntrySource} from './entrySource';

/** Runs before Analytics journal replay and before any screen renders. No Storage. */
export function initializeNativeEntrySource(runtime: PlayRuntime): void {
  runtime.initializeEntrySource(readEntrySource(() => getSchemeUri()));
}
