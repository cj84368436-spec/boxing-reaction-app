import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react-native';
import {DefenseTutorial} from '../components/DefenseTutorial';
beforeEach(()=>jest.useFakeTimers());
afterEach(()=>jest.useRealTimers());
test('requires LEFT then GUARD, ignores repeated inputs, and finishes once after feedback',()=>{
 const done=jest.fn();render(<DefenseTutorial active onComplete={done}/>);
 fireEvent(screen.getByRole('button',{name:'오른쪽 →'}),'pressIn');
 expect(screen.getByText('왼쪽 버튼을 눌러보세요')).toBeTruthy();
 fireEvent(screen.getByRole('button',{name:'← 왼쪽'}),'pressIn');
 fireEvent(screen.getByRole('button',{name:'← 왼쪽'}),'pressIn');
 act(()=>jest.advanceTimersByTime(2000));
 expect(screen.getByText('이번에는 정면 공격 · 가드')).toBeTruthy();
 fireEvent(screen.getByRole('button',{name:'가드'}),'pressIn');
 act(()=>jest.advanceTimersByTime(2000));
 expect(done).toHaveBeenCalledTimes(1);
 act(()=>jest.advanceTimersByTime(10000));expect(done).toHaveBeenCalledTimes(1);
});
test('does not finish in background and cancels pending work on unmount',()=>{
 const done=jest.fn();const view=render(<DefenseTutorial active onComplete={done}/>);
 fireEvent(screen.getByRole('button',{name:'← 왼쪽'}),'pressIn');
 act(()=>jest.advanceTimersByTime(2000));
 fireEvent(screen.getByRole('button',{name:'가드'}),'pressIn');
 view.rerender(<DefenseTutorial active={false} onComplete={done}/>);
 act(()=>jest.advanceTimersByTime(10000));expect(done).not.toHaveBeenCalled();
 view.rerender(<DefenseTutorial active onComplete={done}/>);
 view.unmount();act(()=>jest.advanceTimersByTime(10000));expect(done).not.toHaveBeenCalled();
});
test('completes LEFT then GUARD using only standard accessibility press activation',()=>{
 const done=jest.fn();render(<DefenseTutorial active onComplete={done}/>);
 fireEvent.press(screen.getByRole('button',{name:'← 왼쪽'}),{nativeEvent:{}});
 act(()=>jest.advanceTimersByTime(2000));
 expect(screen.getByText('이번에는 정면 공격 · 가드')).toBeTruthy();
 fireEvent.press(screen.getByRole('button',{name:'가드'}),{nativeEvent:{}});
 act(()=>jest.advanceTimersByTime(2000));expect(done).toHaveBeenCalledTimes(1);
});
