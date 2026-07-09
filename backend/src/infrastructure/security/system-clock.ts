import { Clock } from '../../application/ports/token.port';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
