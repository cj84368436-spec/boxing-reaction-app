import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react-native';
import {DefenseControls} from '../components/DefenseControls';
// Use the installed RN state machine, including delayed pressOut and onClick.
// The installed internal module is Flow-only; use it directly without adding declarations.
const Pressability = require('react-native/Libraries/Pressability/Pressability').default;
function controlProps(){let node=screen.getByRole('button',{name:'← 왼쪽'});while(!node.props.onPressIn&&node.parent)node=node.parent;return node.props;}
const touch=()=>({nativeEvent:{touches:[],changedTouches:[{pageX:0,pageY:0}],pageX:0,pageY:0},currentTarget:1,target:1,persist:jest.fn()});
const click=()=>({nativeEvent:{},currentTarget:1,target:1,stopPropagation:jest.fn()});
beforeEach(()=>jest.useFakeTimers());afterEach(()=>jest.useRealTimers());
test.each(['← 왼쪽','오른쪽 →','뒤로 피하기','가드','숙이기','앞으로 파고들기'])('%s accessibility activation is a released one-shot',label=>{
 const press=jest.fn(),release=jest.fn();render(<DefenseControls level={3} onDefensePressIn={press} onDefensePressOut={release}/>);
 const button=screen.getByRole('button',{name:label});fireEvent.press(button,click());fireEvent.press(button,click());
 expect(press).toHaveBeenCalledTimes(2);expect(release).toHaveBeenCalledTimes(2);
 expect(button.props.accessibilityState.selected).toBe(false);
 expect(button.props.accessibilityHint).toBeTruthy();
});
test.each([0,200])('RN physical release after %i ms does not duplicate defense; subsequent click still works',duration=>{
 const press=jest.fn(),release=jest.fn();const view=render(<DefenseControls onDefensePressIn={press} onDefensePressOut={release}/>);
 const props=controlProps();
 const machine=new Pressability({...props});const handlers=machine.getEventHandlers();const event=touch();
 act(()=>{handlers.onResponderGrant(event as never);});expect(press).toHaveBeenCalledTimes(1);
 act(()=>{jest.advanceTimersByTime(duration);handlers.onResponderRelease(touch() as never);jest.advanceTimersByTime(200);});
 expect(press).toHaveBeenCalledTimes(1);expect(release).toHaveBeenCalledTimes(1);
 act(()=>handlers.onClick(click() as never));expect(press).toHaveBeenCalledTimes(2);expect(release).toHaveBeenCalledTimes(2);
 machine.reset();
});
test('terminated touch does not swallow next accessibility activation, and disabled ignores it',()=>{
 const press=jest.fn(),release=jest.fn();const view=render(<DefenseControls onDefensePressIn={press} onDefensePressOut={release}/>);
 const machine=new Pressability(controlProps());const h=machine.getEventHandlers();
 act(()=>{h.onResponderGrant(touch() as never);h.onResponderTerminate(touch() as never);jest.advanceTimersByTime(200);h.onClick(click() as never);});
 expect(press).toHaveBeenCalledTimes(2);expect(release).toHaveBeenCalledTimes(2);machine.reset();
 view.rerender(<DefenseControls disabled onDefensePressIn={press} onDefensePressOut={release}/>);
 fireEvent.press(screen.getByRole('button',{name:'← 왼쪽'}),click());expect(press).toHaveBeenCalledTimes(2);
});
