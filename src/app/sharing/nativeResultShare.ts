import {SHARED_ENTRY_URI} from '../product/entrySource';
import {getTossShareLink} from '@apps-in-toss/framework';
import {Platform,Share} from 'react-native';
import {createResultShareAdapter} from './resultShareAdapter';

// Dedicated home entry path only; no user, result, seed or referral parameters.
export const nativeResultShare=createResultShareAdapter({
  platform:()=>Platform.OS,
  getLink:()=>getTossShareLink(SHARED_ENTRY_URI),
  show:content=>Share.share(content,{dialogTitle:content.title,subject:content.title}),
});
