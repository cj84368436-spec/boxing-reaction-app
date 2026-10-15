import type {EventData,ProductEventName} from '../product/productEvents';
export type AdEventName = Extract<ProductEventName,`ad_${string}`>;
export type AdEventObserver = (name:AdEventName,data:EventData)=>void;
let nextRequest=0;
/** One native callback event per request, even when the host repeats callbacks. */
export class AdEvents {
  private requestId='';
  private readonly seen=new Set<AdEventName>();
  constructor(private readonly format:'rewarded'|'interstitial',private readonly observer?:AdEventObserver){}
  request():void{this.requestId=`${this.format}-${++nextRequest}`;this.seen.clear();this.emit('ad_request');}
  emit(name:AdEventName,reason?:string):void{
    if(this.seen.has(name))return;this.seen.add(name);
    try{this.observer?.(name,{format:this.format,adRequestId:this.requestId,...(reason?{reason}:{})});}catch{/* No effect on the ad contract. */}
  }
}
