export type ProductEventName = 'app_open'|'landing_view'|'tutorial_start'|'tutorial_complete'|'game_start'|'game_end'|'result_view'|'free_retry_tap'|'ad_retry_tap'|'ad_request'|'ad_loaded'|'ad_start'|'ad_reward'|'ad_dismissed'|'ad_complete'|'ad_fail'|'retry_game_start';
export type EventData = Readonly<Record<string,string|number|boolean|null>>;
export interface ProductEvent {readonly name:ProductEventName;readonly at:number;readonly data:EventData}
/** Bounded, runtime-only diagnostics. No transport or stable user identifier. */
export class ProductEvents {
  private readonly entries:ProductEvent[]=[];
  constructor(private readonly observer?: (event:ProductEvent)=>void, private readonly capacity=500) {}
  record(name:ProductEventName,data:EventData={}):void {
    const event={name,at:Date.now(),data:{...data}};
    this.entries.push(event);
    if(this.entries.length>Math.max(1,this.capacity))this.entries.shift();
    try{this.observer?.(event);}catch{/* Analytics cannot interrupt gameplay. */}
  }
  snapshot():readonly ProductEvent[]{return this.entries.map(event=>({...event,data:{...event.data}}));}
}
