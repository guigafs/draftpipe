export interface Automation {
  id: string;
  name: string;
  description: string | null;
  webhook_url: string;
  headers: Record<string, string>;
  estimated_requests: number;
  average_execution_time: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  automation_id: string;
  executed_by: string;
  status: 'success' | 'error';
  response_status: number | null;
  response_body: string | null;
  execution_time: number | null;
  created_at: string;
}

export interface AutomationFormData {
  name: string;
  description: string;
  webhook_url: string;
  headers: Record<string, string>;
  estimated_requests: number;
  average_execution_time: number;
}
