import type {
  StudioControlAction,
  StudioControlCommand,
  StudioControlOptions,
  StudioControlPoller,
  StudioControlState,
  StudioControlStorage,
} from './types';

export type {
  StudioControlAction,
  StudioControlCommand,
  StudioControlOptions,
  StudioControlPoller,
  StudioControlState,
  StudioControlStorage,
} from './types';

const DEFAULT_COMMAND_KEY = 'comerge:studio-control:command';
const DEFAULT_ACK_KEY = 'comerge:studio-control:ack';
const DEFAULT_STATE_KEY = 'comerge:studio-control:state';
const DEFAULT_INTERVAL_MS = 300;

type ResolvedOptions = Required<
  Pick<StudioControlOptions, 'commandKey' | 'ackKey' | 'stateKey' | 'intervalMs'>
> &
  Pick<StudioControlOptions, 'source'>;

function resolveOptions(options?: StudioControlOptions): ResolvedOptions {
  return {
    commandKey: options?.commandKey ?? DEFAULT_COMMAND_KEY,
    ackKey: options?.ackKey ?? DEFAULT_ACK_KEY,
    stateKey: options?.stateKey ?? DEFAULT_STATE_KEY,
    intervalMs: options?.intervalMs ?? DEFAULT_INTERVAL_MS,
    source: options?.source,
  };
}

function createCommand(action: StudioControlAction, source?: string): StudioControlCommand {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    id: `${ts}-${rand}`,
    action,
    ts,
    source,
  };
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isAction(value: unknown): value is StudioControlAction {
  return value === 'show' || value === 'hide' || value === 'toggle';
}

function isCommand(value: unknown): value is StudioControlCommand {
  if (!value || typeof value !== 'object') return false;
  const v = value as StudioControlCommand;
  return typeof v.id === 'string' && isAction(v.action) && typeof v.ts === 'number';
}

function isState(value: unknown): value is StudioControlState {
  if (!value || typeof value !== 'object') return false;
  const v = value as StudioControlState;
  return typeof v.open === 'boolean' && typeof v.ts === 'number';
}

async function writeCommand(
  storage: StudioControlStorage,
  action: StudioControlAction,
  options?: StudioControlOptions
): Promise<void> {
  const resolved = resolveOptions(options);
  const command = createCommand(action, resolved.source);
  try {
    await storage.setItem(resolved.commandKey, JSON.stringify(command));
  } catch {
    
  }
}

export async function showComergeStudioUI(
  storage: StudioControlStorage,
  options?: StudioControlOptions
): Promise<void> {
  await writeCommand(storage, 'show', options);
}

export async function hideComergeStudioUI(
  storage: StudioControlStorage,
  options?: StudioControlOptions
): Promise<void> {
  await writeCommand(storage, 'hide', options);
}

export async function toggleComergeStudioUI(
  storage: StudioControlStorage,
  options?: StudioControlOptions
): Promise<void> {
  await writeCommand(storage, 'toggle', options);
}

export function startStudioControlPolling(
  storage: StudioControlStorage,
  onCommand: (action: StudioControlAction, command: StudioControlCommand) => void,
  options?: StudioControlOptions
): StudioControlPoller {
  const resolved = resolveOptions(options);
  let lastSeenId: string | null = null;
  let ackInitialized = false;
  let stopped = false;
  let inFlight = false;

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      if (!ackInitialized) {
        const ackRaw = await storage.getItem(resolved.ackKey);
        const ackValue = safeJsonParse<{ id: string }>(ackRaw);
        if (ackValue?.id) {
          lastSeenId = ackValue.id;
        }
        const stateRaw = await storage.getItem(resolved.stateKey);
        const state = safeJsonParse<StudioControlState>(stateRaw);
        const initRaw = await storage.getItem(resolved.commandKey);
        const initParsed = safeJsonParse<StudioControlCommand>(initRaw);
        if (isCommand(initParsed) && !lastSeenId && isState(state) && initParsed.ts <= state.ts) {
          lastSeenId = initParsed.id;
          await storage.setItem(resolved.ackKey, JSON.stringify({ id: initParsed.id, ts: Date.now() }));
        }
        ackInitialized = true;
      }
      const raw = await storage.getItem(resolved.commandKey);
      const parsed = safeJsonParse<StudioControlCommand>(raw);
      if (!isCommand(parsed)) return;
      if (parsed.id === lastSeenId) return;
      lastSeenId = parsed.id;
      try {
        onCommand(parsed.action, parsed);
      } catch {
        
      }
      await storage.setItem(resolved.ackKey, JSON.stringify({ id: parsed.id, ts: Date.now() }));
      const currentRaw = await storage.getItem(resolved.commandKey);
      const currentParsed = safeJsonParse<StudioControlCommand>(currentRaw);
      if (currentParsed?.id === parsed.id) {
        await storage.setItem(resolved.commandKey, '');
      }
    } catch {
      
    } finally {
      inFlight = false;
    }
  };

  const interval = setInterval(tick, resolved.intervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
  };
}

export async function publishComergeStudioUIState(
  storage: StudioControlStorage,
  open: boolean,
  options?: StudioControlOptions
): Promise<void> {
  const resolved = resolveOptions(options);
  const state: StudioControlState = {
    open,
    ts: Date.now(),
    source: resolved.source,
  };
  try {
    await storage.setItem(resolved.stateKey, JSON.stringify(state));
  } catch {
    
  }
}

export async function isComergeStudioUIShown(
  storage: StudioControlStorage,
  options?: StudioControlOptions
): Promise<boolean | null> {
  const resolved = resolveOptions(options);
  try {
    const raw = await storage.getItem(resolved.stateKey);
    const parsed = safeJsonParse<StudioControlState>(raw);
    if (!isState(parsed)) return null;
    return parsed.open;
  } catch {
    return null;
  }
}
