import { ActivityRepository } from '../ports/activity-repository.port';

export class QueryActivityService {
  constructor(private readonly activity: ActivityRepository) {}

  execute(params: { employeeId: string; from: Date; to: Date; cursor?: string; limit: number }) {
    return this.activity.query(params);
  }
}
