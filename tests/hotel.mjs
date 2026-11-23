// Pure hotel stay tests: first-night voucher, paid nights, guest parking/delivery capacity, starter alreadyHoused, save normalising (I8/I10).
import assert from 'node:assert/strict';
import {HOTEL,normalizeHotel,hotelNightsLeft,hotelRoomHeld,hotelCanSleep,hotelTransaction} from '../dist/hotel.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {homesHeld,dropSpot,parkingAim,vehicleCapacity} from '../dist/orders.js';
import {alreadyHoused,fresh as freshStarter} from '../dist/starter.js';
import {isWalkable} from '../dist/world.js';

const base=()=>({...freshProgress(),cash:20000});
assert.equal(hotelRoomHeld(base()),false);
assert.equal(hotelCanSleep(base()),false);
assert.equal(homesHeld(base()).length,0);
assert.equal(isWalkable(HOTEL.dropSpot.x,HOTEL.dropSpot.z),true,'hotel drop spot is walkable');
assert.equal(isWalkable(HOTEL.parkBay.x,HOTEL.parkBay.z),true,'hotel guest parking bay is walkable');

// Complimentary first-night voucher: allows sleep on current day, does NOT grant vehicle bay or home ownership
const v=hotelTransaction(base(),'voucher');
assert.ok(!v.error&&hotelCanSleep(v.state),'voucher grants tonight rest');
assert.equal(hotelRoomHeld(v.state),false,'voucher alone does not count as a paid home');
assert.equal(vehicleCapacity(v.state),0,'voucher gives bed only, no parking');
assert.ok(hotelTransaction(v.state,'voucher').error,'voucher cannot be claimed twice');
assert.equal(hotelCanSleep({...v.state,housing:{...v.state.housing,day:2}}),false,'voucher expires next day');

// Paid nights ($25/night): grants rest, Homes/Orders dropSpot, 1 guest parking bay, starter step 8
const p1=hotelTransaction(v.state,'pay-nights',{nights:2});
assert.equal(p1.paid,5000);
assert.equal(hotelNightsLeft(p1.state),2);
assert.equal(hotelRoomHeld(p1.state),true);
assert.equal(vehicleCapacity(p1.state),1,'paid stay grants 1 guest parking bay');
assert.equal(homesHeld(p1.state).some(h=>h.id===HOTEL.id),true,'listed in homesHeld');
assert.deepEqual(dropSpot(HOTEL.id),HOTEL.dropSpot);
assert.deepEqual(parkingAim(HOTEL.id),HOTEL.parkBay);
assert.equal(alreadyHoused({...p1.state,starter:{...freshStarter(),step:8}}),true,'paid stay satisfies beat 9 alreadyHoused');

// Expires automatically as housing.day advances
assert.equal(hotelRoomHeld({...p1.state,housing:{...p1.state.housing,day:3}}),false,'2 nights from day 1 expires on day 3');

// Save round-trip preserves hotel state cleanly while old saves without hotel stay clean
const rt=normalizeProgress(JSON.parse(JSON.stringify(p1.state)));
assert.equal(hotelNightsLeft(rt),2);
assert.equal(normalizeHotel(null).paidUntilDay,0);
assert.equal('hotel' in normalizeProgress(freshProgress()),false,'fresh save stays clean without hotel field');
console.log('PASS hotel: voucher bed pass, paid nights ($25), guest bay capacity, expiry, save round-trip');
