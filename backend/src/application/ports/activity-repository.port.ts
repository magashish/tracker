import { ActivitySample } from '../../domain/entities/activity';

export interface ActivityRepository {
  insertOne(sample: ActivitySample): Promise<void>;
  insertBatch(samples: ActivitySample[]): Promise<number>;
  query(params: {
    employeeId: string;
    from: Date;
    to: Date;
    cursor?: string;
    limit: number;
  }): Promise<{ items: ActivitySample[]; nextCursor: string | null }>;
}
