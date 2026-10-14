import {readCompetition,startChallenge} from '../session/competitionClient';
describe('competition network boundaries',()=>{
 const originalFetch=global.fetch;
 afterEach(()=>{global.fetch=originalFetch;jest.useRealTimers();});
 it('reads records without posting a new attempt',async()=>{global.fetch=jest.fn(async()=>({ok:true,json:async()=>({day:'2026-09-20',participants:0,standing:null})})) as any;await expect(readCompetition()).resolves.toMatchObject({standing:null});expect(global.fetch).toHaveBeenCalledWith('/api/challenge/records',expect.objectContaining({method:'GET'}));});
 it('times out even when the response body never finishes',async()=>{jest.useFakeTimers();global.fetch=jest.fn(async()=>({ok:true,json:()=>new Promise(()=>{})})) as any;const result=expect(startChallenge()).rejects.toThrow();await jest.advanceTimersByTimeAsync(10000);await result;});
});
