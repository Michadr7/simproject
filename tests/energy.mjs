import assert from 'node:assert/strict';
import {tickLife,ENERGY_RATES,lifeTransaction} from '../dist/life.js';
import {freshProgress} from '../dist/jobs.js';
const simulate=(fps,moving,running,load=1)=>{let life={food:100,energy:100,groceries:0};for(let i=0;i<60*fps;i++)life=tickLife(life,1/fps,moving,running,load);return life.energy};
for(const fps of [5,10,25,60,120]){
 assert(Math.abs(simulate(fps,false,false)-(100-60*ENERGY_RATES.standing))<1e-8);
 assert(Math.abs(simulate(fps,true,false)-(100-60*ENERGY_RATES.walking))<1e-8);
 assert(Math.abs(simulate(fps,true,true)-(100-60*ENERGY_RATES.running))<1e-8);
 assert(Math.abs(simulate(fps,true,false,2)-(100-120*ENERGY_RATES.walking))<1e-8);
}
let s=freshProgress();s.cash=2000;s.life.energy=10;s.life.food=100;s.life.groceries=1;
s=lifeTransaction(s,'cook','home').state;assert.equal(s.life.energy,30);
s=lifeTransaction(s,'drink','market').state;assert.equal(s.life.energy,60);assert.equal(s.cash,1700);
s=lifeTransaction(s,'meal','cafe').state;assert.equal(s.life.energy,75);
s.life.energy=99;s=lifeTransaction(s,'drink','market').state;assert.equal(s.life.energy,100);
assert.equal(tickLife({energy:0,food:0},.04,true,true).energy,0);
console.log('Frame-rate-independent energy rates, heavy load, food/drink restoration and bounds passed.');
