import { FastifyReply, FastifyRequest } from 'fastify';
import { Container } from '../../../container';

interface EmployeeParams {
  employeeId: string;
}
interface DateQuery {
  date?: string;
}

export function buildDashboardController(container: Container) {
  return {
    async live(_request: FastifyRequest, reply: FastifyReply) {
      const employees = await container.dashboard.getLiveEmployees.execute();
      reply.send({ data: employees });
    },

    async employeeSummary(request: FastifyRequest, reply: FastifyReply) {
      const { employeeId } = request.params as EmployeeParams;
      const { date: dateStr } = request.query as DateQuery;
      const date = dateStr ? new Date(dateStr) : new Date();
      const summary = await container.dashboard.getEmployeeReport.daySummary(employeeId, date);
      reply.send({ data: summary });
    },

    async employeeTimeline(request: FastifyRequest, reply: FastifyReply) {
      const { employeeId } = request.params as EmployeeParams;
      const { date: dateStr } = request.query as DateQuery;
      const date = dateStr ? new Date(dateStr) : new Date();
      const timeline = await container.dashboard.getEmployeeReport.timeline(employeeId, date);
      reply.send({ data: timeline });
    },
  };
}
