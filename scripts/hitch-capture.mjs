// Capture event-level frame gaps and CPU render time in the packaged game.
// Run node scripts/hitch-capture.mjs <output-directory> [--headless] [--reverse].
import {spawn} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {createDevServer} from './dev-server.mjs';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const VERSION = '0.36.3';
const VEHICLE = 'v1';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MODES = {webgl: 'WebGLRenderer', webgpu: 'WebGPUBackend'};

// Serialized by CDP and installed before any game modules run.
function installCapture({progress, vehicle, expected}) {
  const $ = id => document.getElementById(id);
  const now = () => performance.now();
  const nativeRaf = window.requestAnimationFrame.bind(window);
  const frames = [], events = [];
  const mark = (name, data = {}) => events.push({name, atMs: now(), ...data});
  let game, insideFrame = false, stopped = false, previousRaf;
  let renderMs, renders, rendering = false, worldFrame, firstWorldAt, firstWorldMarked = false;
  let seated = false, entries = 0;

  localStorage.setItem('edenridge.character.v1', JSON.stringify({version: 1, appearance: {name: 'Hitch Probe'}}));
  localStorage.setItem('edenridge.progress.v1', JSON.stringify({version: 1, progress}));
  localStorage.setItem('edenridge.settings.v1', JSON.stringify({quality: 'high'}));

  function measureFrame(callback, rafMs) {
    const atMs = now();
    renderMs = 0;
    renders = 0;
    worldFrame = false;
    insideFrame = true;
    try {
      callback(rafMs);
    } finally {
      insideFrame = false;
      frames.push({
        atMs, rafMs, gapMs: previousRaf === undefined ? null : rafMs - previousRaf,
        cpuFrameMs: now() - atMs, cpuRenderMs: renderMs, renders, worldFrame
      });
      previousRaf = rafMs;
    }
  }

  let frame, wrapped;
  window.requestAnimationFrame = callback => {
    if (stopped || callback.name !== 'frame') return nativeRaf(callback);
    if (frame !== callback) {
      frame = callback;
      wrapped = rafMs => stopped ? callback(rafMs) : measureFrame(callback, rafMs);
    }
    return nativeRaf(wrapped);
  };

  const backend = renderer => renderer.isWebGPURenderer
    ? renderer.backend?.isWebGPUBackend ? 'WebGPUBackend' : 'WebGLBackend'
    : renderer.isWebGLRenderer ? 'WebGLRenderer' : 'unknown';
  Object.defineProperty(window, '__city', {
    configurable: true,
    get: () => game,
    set(value) {
      game = value;
      const renderer = game.renderer;
      const render = renderer.render;
      renderer.render = function (scene, camera) {
        if (!insideFrame || rendering) return render.call(this, scene, camera);
        if (scene === game.scene && $('welcome').hidden) {
          worldFrame = true;
          if (!firstWorldMarked) {
            firstWorldMarked = true;
            firstWorldAt = now();
            mark('first-play-frame', {frameIndex: frames.length, warmMs: globalThis.__warmMs ?? null});
          }
          const drivingNow = game.driving.active?.spec.id === vehicle;
          if (drivingNow !== seated) {
            seated = drivingNow;
            if (seated) mark(++entries === 1 ? 'first-seat-render' : 'repeat-seat-render', {frameIndex: frames.length});
          }
        }
        const start = now();
        rendering = true;
        try {
          return render.call(this, scene, camera);
        } finally {
          rendering = false;
          renderMs += now() - start;
          renders++;
        }
      };
      queueMicrotask(() => {
        mark('game-ready');
        if (backend(renderer) !== expected) return;
        const start = $('start');
        mark('early-play');
        const t = now();
        start.click();
        mark('play-handler-return', {cpuActionMs: now() - t, queued: start.disabled && !$('welcome').hidden});
      });
    }
  });

  const delay = ms => new Promise(ok => setTimeout(ok, ms));
  async function until(predicate, label) {
    const end = now() + 20000;
    while (!predicate()) {
      if (now() > end) throw new Error('Timed out waiting for ' + label);
      await delay(75);
    }
  }
  function action(name, run) {
    mark(name);
    const start = now();
    run();
    mark(name + '-handler-return', {cpuActionMs: now() - start});
  }
  function key(code) {
    const opts = {code, key: code.at(-1).toLowerCase(), bubbles: true, cancelable: true};
    document.body.dispatchEvent(new KeyboardEvent('keydown', opts));
    document.body.dispatchEvent(new KeyboardEvent('keyup', opts));
  }
  function quality(value) {
    $('quality').value = value;
    $('quality').dispatchEvent(new Event('change', {bubbles: true}));
    const saved = JSON.parse(localStorage.getItem('edenridge.settings.v1'));
    if (saved.quality !== value || game.renderer.shadowMap.enabled !== (value === 'high')) {
      throw new Error('Quality did not switch to ' + value);
    }
  }
  async function settleAfterRenders(ms) {
    const deadline = now() + ms;
    await delay(ms);
    // Timers can fire while rAF is stalled. Let rendering recover before the next action.
    await until(() => frames.at(-4)?.atMs >= deadline && now() - frames.at(-1).atMs < 150, 'four frames after the settling delay');
  }

  async function route() {
    if (backend(game.renderer) !== expected) throw new Error('Expected ' + expected + ', got ' + backend(game.renderer));
    await until(() => firstWorldMarked && frames.some(f => f.worldFrame && f.renders), 'the first Play render');
    await delay(2000);
    const pickup = game.driving.byId.get(vehicle);
    if (!pickup?.present || pickup.display) throw new Error('Missing owned Eastbank pickup');
    const door = game.driving.doors().find(d => d.id === vehicle && d.seat === 'driver');
    const {x, z} = door;
    const yaw = pickup.state.yaw + Math.PI / 2;
    const stageAtDoor = () => {
      game.place(x, z);
      game.view(yaw, .38, 7);
    };
    action('eastbank-arrival', stageAtDoor);
    await settleAfterRenders(3000);
    action('first-entry', () => key('KeyE'));
    await until(() => entries === 1 && game.driving.seatSide === 'driver', 'first driver entry');
    await delay(2000);
    action('vehicle-exit', () => key('KeyE'));
    await until(() => !game.driving.active, 'vehicle exit');
    await settleAfterRenders(1600);
    action('repeat-entry-setup', stageAtDoor);
    await settleAfterRenders(1600);
    action('repeat-entry', () => key('KeyE'));
    await until(() => entries === 2 && game.driving.seatSide === 'driver', 'repeat driver entry');
    await delay(2000);
    action('night-setup', () => game.lookAt(1320));
    await until(() => game.nightLights.state().dark && game.nightLights.ownOn, 'night and automatic headlights');
    await delay(2000);
    // Auto and On give the same beam at night. Cycle through On before measuring Off.
    action('headlights-auto-to-on', () => key('KeyL'));
    await delay(1600);
    for (const [name, on] of [['off', false], ['on', true], ['repeat-auto-to-on', true], ['repeat-off', false], ['repeat-on', true]]) {
      action('headlights-' + name, () => key('KeyL'));
      await until(() => game.nightLights.ownOn === on, 'headlights ' + name);
      mark('headlights-' + name + '-verified', {on});
      await delay(1600);
    }
    $('help').click();
    $('showSettings').click();
    if ($('settings').hidden) throw new Error('Settings did not open');
    await delay(1600);
    for (const [name, tier] of [['high-to-low', 'low'], ['low-to-high', 'high']]) {
      action(name, () => quality(tier));
      await until(() => game.nightLights.state().spot === (tier === 'high'), 'headlight rig for ' + tier);
      await settleAfterRenders(1800);
    }
    mark('finished');
  }

  window.__hitch = {
    route,
    stop() {
      stopped = true;
      window.requestAnimationFrame = nativeRaf;
      const adapter = game?.renderer.backend?.device?.adapterInfo;
      return {
        frames, events, backend: game ? backend(game.renderer) : null,
        directOutput: !!game?.renderer.__directOutput, firstWorldAt,
        gpuAdapter: adapter ? {vendor: adapter.vendor, architecture: adapter.architecture, isFallbackAdapter: adapter.isFallbackAdapter} : null,
        warmMs: globalThis.__warmMs ?? null, vehicle: game?.driving.byId.get(vehicle)?.spec.home,
        viewport: [innerWidth, innerHeight, devicePixelRatio], userAgent: navigator.userAgent
      };
    }
  };
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((ok, fail) => {
    socket.addEventListener('open', ok, {once: true});
    socket.addEventListener('error', () => fail(new Error('Could not connect to DevTools')), {once: true});
  });
  let id = 0;
  const pending = new Map();
  function settle(command, error, result) {
    pending.delete(command.id);
    clearTimeout(command.timer);
    if (error) command.reject(error);
    else command.resolve(result);
  }
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const command = pending.get(message.id);
    if (command) settle(command, message.error && new Error(message.error.message), message.result);
  });
  socket.addEventListener('close', () => {
    for (const command of pending.values()) settle(command, new Error('DevTools disconnected'));
  });
  return {
    call(method, params = {}, timeout = 10000) {
      return new Promise((resolve, reject) => {
        if (socket.readyState !== WebSocket.OPEN) return reject(new Error('DevTools is closed'));
        const command = {id: ++id, resolve, reject};
        command.timer = setTimeout(() => settle(command, new Error(method + ' timed out')), timeout);
        pending.set(id, command);
        socket.send(JSON.stringify({id, method, params}));
      });
    },
    close: () => socket.close()
  };
}

async function waitForDevTools(child, profile) {
  for (let attempt = 0; attempt < 100 && child.exitCode === null && !child.launchError; attempt++) {
    try {
      const port = parseInt(await readFile(join(profile, 'DevToolsActivePort'), 'utf8'), 10);
      const url = 'http://127.0.0.1:' + port;
      const version = await (await fetch(url + '/json/version')).json();
      const targets = await (await fetch(url + '/json/list')).json();
      const page = targets.find(target => target.type === 'page');
      if (page) return {version, page};
    } catch {}
    await sleep(100);
  }
  throw child.launchError ?? new Error('Chrome did not expose a DevTools page (exit ' + child.exitCode + ')');
}

const round = value => value == null ? null : Number(value.toFixed(2));
function peak(samples, key, renderOnly = false) {
  return samples.reduce((max, row) => {
    if (renderOnly && !row.renders) return max;
    return row[key] == null ? max : Math.max(max ?? 0, row[key]);
  }, null);
}

export function summarize({events, frames, firstWorldAt}) {
  const actions = events.filter(e => !/(verified|handler-return|game-ready)$/.test(e.name));
  return actions.filter(e => e.name !== 'finished').map(event => {
    const {name, atMs} = event;
    const next = actions.find(e => e.atMs > atMs && e.frameIndex === undefined);
    const limit = next?.atMs ?? Infinity;
    const end = Math.min(atMs + 1500, limit);
    const samples = frames.filter(f => f.atMs >= atMs && f.atMs < end);
    // A render marker fires inside its owning frame. The next callback can report a gap even after the window ends.
    const owner = frames[event.frameIndex];
    if (owner && samples[0] !== owner) samples.unshift(owner);
    const trailing = frames.find(f => f.atMs >= end && f.atMs < limit);
    const gapSamples = trailing ? [...samples, trailing] : samples;
    const baseline = frames.filter(f => f.atMs >= atMs - 750 && f.atMs < atMs && f.gapMs != null).map(f => f.gapMs).sort((a, b) => a - b);
    return {
      event: name, frames: samples.length,
      baselineMedianGapMs: round(baseline.length ? baseline[Math.floor(baseline.length / 2)] : null),
      maxGapMs: round(peak(gapSamples, 'gapMs')), maxCpuFrameMs: round(peak(samples, 'cpuFrameMs')),
      maxCpuRenderMs: round(peak(samples, 'cpuRenderMs', true)),
      actionCpuMs: round(events.find(e => e.name === name + '-handler-return' || (name === 'early-play' && e.name === 'play-handler-return'))?.cpuActionMs),
      playToFirstRenderMs: name === 'early-play' && firstWorldAt != null ? round(firstWorldAt - atMs) : null
    };
  });
}

async function capture({mode, origin, out, headless, progress}) {
  const temp = resolve(tmpdir());
  const profile = await mkdtemp(join(temp, 'eden-hitch-'));
  const args = [
    ...(headless ? ['--headless=new'] : []),
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--remote-debugging-port=0', '--window-size=1280,820', '--user-data-dir=' + profile, 'about:blank'
  ];
  const child = spawn(process.env.HITCH_CHROME || CHROME, args, {stdio: ['ignore', 'ignore', 'pipe']});
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-12000); });
  const exited = new Promise(ok => {
    child.once('exit', ok);
    child.once('error', error => { child.launchError = error; ok(); });
  });
  let browser, page, diagnostics;
  const result = {version: VERSION, mode, query: '?debug&webgpu=' + (mode === 'webgpu' ? 1 : 0), headless};
  const run = async (expression, timeout) => {
    const value = await page.call('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, timeout);
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text);
    return value.result.value;
  };
  try {
    console.log('Capturing ' + mode + ' from a fresh Chrome profile');
    const cdp = await waitForDevTools(child, profile);
    result.browser = cdp.version.Browser;
    browser = await connect(cdp.version.webSocketDebuggerUrl);
    page = await connect(cdp.page.webSocketDebuggerUrl);
    const {gpu} = await browser.call('SystemInfo.getInfo');
    result.gpu = {devices: gpu.devices, glRenderer: gpu.auxAttributes?.glRenderer, webgpu: gpu.featureStatus?.webgpu};
    await page.call('Page.enable');
    await page.call('Page.bringToFront');
    await page.call('Emulation.setDeviceMetricsOverride', {width: 1280, height: 720, deviceScaleFactor: 1, mobile: false});
    await page.call('Page.addScriptToEvaluateOnNewDocument', {
      source: '(' + installCapture.toString() + ')(' + JSON.stringify({progress, vehicle: VEHICLE, expected: MODES[mode]}) + ')'
    });
    const nav = await page.call('Page.navigate', {url: origin + '/' + result.query});
    if (nav.errorText) throw new Error(nav.errorText);
    diagnostics = "({ready: !!window.__city, error: document.getElementById('error')?.hidden === false ? document.getElementById('error').textContent : null})";
    for (let attempt = 0; attempt < 240; attempt++) {
      const state = await run(diagnostics);
      if (state.error) throw new Error(state.error);
      if (state.ready) break;
      if (attempt === 239) throw new Error('Packaged game did not initialize');
      await sleep(250);
    }
    await run('window.__hitch.route()', 95000);
  } catch (error) {
    result.error = error.message;
  } finally {
    if (page && diagnostics) {
      try {
        Object.assign(result, await run('window.__hitch?.stop()'));
        if (result.frames) result.summary = summarize(result);
      } catch (error) {
        result.error ??= error.message;
      }
    }
    page?.close();
    if (browser) await browser.call('Browser.close', {}, 3000).catch(() => {});
    browser?.close();
    if (await Promise.race([exited.then(() => false), sleep(3000, true)])) child.kill();
    await exited;
    // Only remove the profile directory just created inside the resolved temp directory.
    if (dirname(profile) === temp) {
      await rm(profile, {recursive: true, force: true, maxRetries: 4, retryDelay: 150}).catch(error => {
        result.cleanupWarning = error.message;
      });
    }
  }
  if (result.error) result.browserStderr = stderr;
  await writeFile(join(out, mode + '.json'), JSON.stringify(result, null, 2) + '\n');
  if (result.error) console.error(mode + ': ' + result.error);
  else {
    console.log('Captured ' + result.backend + ', ' + result.frames.length + ' frames, ' + result.gpu.glRenderer);
    console.table(result.summary);
  }
  return result;
}

async function main() {
  const [destination, ...options] = process.argv.slice(2);
  if (!destination || destination.startsWith('--') || options.some(x => !['--headless', '--reverse'].includes(x))) {
    console.error('Usage: node scripts/hitch-capture.mjs <output-directory> [--headless] [--reverse]');
    process.exitCode = 2;
    return;
  }
  const html = await readFile(join(DIST, 'index.html'), 'utf8');
  if (!html.includes("import('./releases/" + VERSION + "/game.js')")) throw new Error('Expected packaged Eden Ridge ' + VERSION);
  const {skipStarter} = await import('../dist/releases/0.36.3/starter.js');
  const {MAP} = await import('../dist/releases/0.36.3/map-definition.js');
  const pickup = MAP.vehicles.find(v => v.id === 'eastbank-offroad');
  const progress = {
    cash: 1000, starter: skipStarter(),
    vehicles: [{uid: VEHICLE, model: pickup.model, ...pickup.home, fuelMgal: pickup.fuel.tankMgal}]
  };
  const out = resolve(destination);
  await mkdir(out, {recursive: true});
  const dev = createDevServer({root: DIST, port: 0});
  const origin = 'http://127.0.0.1:' + await dev.listen();
  try {
    const modes = Object.keys(MODES);
    if (options.includes('--reverse')) modes.reverse();
    for (const mode of modes) {
      const result = await capture({mode, origin, out, headless: options.includes('--headless'), progress});
      if (result.error) process.exitCode = 1;
    }
    console.log('Capture files in ' + out);
  } finally {
    await dev.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
