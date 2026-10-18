export type ProductEventName = 'app_open'|'landing_view'|'tutorial_start'|'tutorial_complete'|'game_start'|'game_end'|'result_view'|'free_retry_tap'|'ad_retry_tap'|'ad_request'|'ad_loaded'|'ad_start'|'ad_reward'|'ad_dismissed'|'ad_complete'|'ad_fail'|'retry_game_start'|'share_tap'|'share_outcome';
export type EventData = Readonly<Record<string,string|number|boolean|null>>;
export interface ProductEvent {readonly name:ProductEventName;readonly at:number;readonly data:EventData}
export type ProductEventObserver=(event:ProductEvent)=>void|Promise<void>;
/** Bounded runtime journal; optional observers are isolated from game flow. */
export class ProductEvents {
  private readonly entries:ProductEvent[]=[];
  private readonly observers=new Set<ProductEventObserver>();
  private failures=0;
  get observerFailureCount():number{return this.failures;}
  constructor(private readonly observer?:ProductEventObserver, private readonly capacity=500) {}
  subscribe(observer:ProductEventObserver,replay=false):()=>void {
    this.observers.add(observer);
    if(replay)for(const event of this.snapshot())this.notify(observer,event);
    return ()=>{this.observers.delete(observer);};
  }
  private notify(observer:ProductEventObserver,event:ProductEvent):void {
    try{const response=observer({...event,data:{...event.data}});if(response)void Promise.resolve(response).catch(()=>{this.failures++;});}
    catch{this.failures++;}
  }
  record(name:ProductEventName,data:EventData={}):void {
    const event={name,at:Date.now(),data:{...data}};
    this.entries.push(event);
    if(this.entries.length>Math.max(1,this.capacity))this.entries.shift();
    if(this.observer)this.notify(this.observer,event);
    for(const observer of this.observers)this.notify(observer,event);
  }
  snapshot():readonly ProductEvent[]{return this.entries.map(event=>({...event,data:{...event.data}}));}
}
