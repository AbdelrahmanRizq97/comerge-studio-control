export type StudioControlAction = 'show' | 'hide' | 'toggle';

export type StudioControlCommand = {
  id: string;
  action: StudioControlAction;
  ts: number;
  source?: string;
};

export type StudioControlState = {
  open: boolean;
  ts: number;
  source?: string;
};

export type StudioControlOptions = {
  commandKey?: string;
  ackKey?: string;
  stateKey?: string;
  intervalMs?: number;
  source?: string;
};

export type StudioControlPoller = {
  stop: () => void;
};
