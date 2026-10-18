import {eventLog,getOperationalEnvironment} from '@apps-in-toss/framework';
import {version} from '../../../package.json';
import type {ProductEvents} from '../product/productEvents';
import {createAppsAnalyticsAdapter} from './appsAnalyticsAdapter';

type Adapter=ReturnType<typeof createAppsAnalyticsAdapter>;
const installed=new WeakMap<ProductEvents,Adapter>();
/** Native entry only. Preview never imports this module; tests use an explicit mock. */
export function installNativeProductAnalytics(events:ProductEvents):Adapter|null {
  try{
    if(typeof __DEV__==='undefined'||__DEV__||getOperationalEnvironment()!=='toss')return null;
    const existing=installed.get(events);if(existing)return existing;
    const adapter=createAppsAnalyticsAdapter(payload=>eventLog(payload),{appVersion:version});
    installed.set(events,adapter);
    // The singleton's app_open precedes native entry initialization; preserve it once.
    events.subscribe(adapter.record,true);
    return adapter;
  }catch{return null;}
}
